<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarkdownEditor from "@/components/MarkdownEditor.vue";
import MetadataPanel from "@/components/MetadataPanel.vue";
import PushDialog from "@/components/PushDialog.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { CMS_CONFIG } from "@/config";
import { parsePost, serializePost } from "@/lib/frontmatter";
import { draftBranchFor, kebab } from "@/lib/slug";
import { applyTemplate, DEFAULT_COMMIT_TEMPLATE } from "@/lib/template";
import { githubClient } from "@/stores/auth";
import { deleteLocalDraft, draftKey, loadLocalDraft, saveLocalDraft } from "@/stores/drafts";
import { activeRepo, ensureDefaultBranch, resolveConfig } from "@/stores/repos";
import { settings } from "@/stores/settings";

const route = useRoute();
const router = useRouter();

type Status = "idle" | "local" | "pushing" | "pushed" | "error";

const branchOverride =
  typeof route.query.branch === "string" && route.query.branch.trim()
    ? route.query.branch.trim()
    : "";

const state = reactive({
  loading: true,
  loadError: "",
  isNew: route.query.new === "1",
  repoPath: "",
  branch: "",
  fileSha: undefined as string | undefined,
  fm: {} as Record<string, unknown>,
  body: "",
  status: "idle" as Status,
  error: "",
  prUrl: null as string | null,
  pushedAt: null as Date | null,
  localSavedAt: null as Date | null,
  baseBranch: "",
  baseline: "",
  hasLocalDraft: false,
  serverSnapshot: { body: "", fm: {} as Record<string, unknown> },
});

const target = computed(() => activeRepo());
const cfg = computed(() => (target.value ? resolveConfig(target.value) : null));

const title = computed(() => String(state.fm.title ?? "") || "Untitled");
const action = computed(() => (state.fileSha ? "Update" : "Create"));
const key = computed(() => {
  const r = target.value;
  return r ? draftKey(r.owner, r.repo, state.repoPath) : "";
});

const snapshot = () => JSON.stringify({ body: state.body, fm: state.fm });
const dirty = computed(() => !state.loading && !state.loadError && snapshot() !== state.baseline);

const slug = computed(() => {
  const file = state.repoPath.split("/").pop() ?? "";
  return file.replace(/\.[^.]+$/, "");
});

const onDefaultBranch = computed(
  () => Boolean(state.baseBranch) && state.branch === state.baseBranch,
);

const editorRef = ref<{ insertSnippet: (text: string) => void } | null>(null);
const insertOpen = ref(false);

function insertComponent(text: string): void {
  editorRef.value?.insertSnippet(text);
  insertOpen.value = false;
}
const branchUrl = computed(() =>
  target.value
    ? `https://github.com/${target.value.owner}/${target.value.repo}/tree/${encodeURIComponent(state.branch)}`
    : "#",
);

const crumbs = computed(() => {
  const r = target.value;
  if (!r) return state.repoPath;
  return state.repoPath.startsWith(`${r.contentPath}/`)
    ? state.repoPath.slice(r.contentPath.length + 1)
    : state.repoPath;
});

function defaultCommitMessage(): string {
  const tpl = settings.commitTemplate || cfg.value?.commitTemplate || DEFAULT_COMMIT_TEMPLATE;
  return applyTemplate(tpl, { action: action.value, path: state.repoPath, title: title.value });
}

onMounted(async () => {
  try {
    const repo = target.value;
    if (!repo) throw new Error("No repository selected. Pick one from the repositories screen.");
    const client = githubClient();
    state.baseBranch = await ensureDefaultBranch(client);

    let serverFm: Record<string, unknown>;
    let serverBody: string;

    if (state.isNew) {
      const rawTitle = String(route.query.title ?? "Untitled");
      const folder = String(route.query.folder ?? "").replace(/^\/+|\/+$/g, "");
      const dir = folder ? `${repo.contentPath}/${folder}` : repo.contentPath;
      const ext = cfg.value?.extension ?? ".md";
      state.repoPath = `${dir}/${kebab(rawTitle)}${ext}`;
      state.branch = branchOverride || draftBranchFor(state.repoPath);
      serverFm = {
        ...(cfg.value?.template ?? {}),
        title: rawTitle,
        pubDatetime: new Date().toISOString(),
      };
      serverBody = "";
    } else {
      const path = String(route.query.path ?? "");
      if (!path) throw new Error("Nothing to edit. Open a post from the list.");
      state.repoPath = path;
      state.branch = branchOverride || draftBranchFor(path);

      let source: { content: string; sha: string } | null;
      if (!branchOverride || state.branch.startsWith("draft/")) {
        // WriteShare draft flow: resume the draft branch if it holds this file.
        const draft = await client.getFile(repo, state.branch, path).catch(() => null);
        const base = draft ? null : await client.getFile(repo, state.baseBranch, path);
        source = draft ?? base;
        state.fileSha = draft?.sha; // only same-branch shas are valid for updates
      } else {
        // Working directly on an existing branch: its sha is the push target.
        source = await client.getFile(repo, state.branch, path);
        state.fileSha = source?.sha;
      }
      if (!source) throw new Error(`File not found: ${path}`);
      const parsed = parsePost(source.content);
      serverFm = { ...(cfg.value?.template ?? {}), ...parsed.data };
      serverBody = parsed.body;
    }

    state.serverSnapshot = { body: serverBody, fm: { ...serverFm } };
    state.baseline = JSON.stringify({ body: serverBody, fm: serverFm });

    // A local draft is newer work than the server copy; it wins on resume.
    const local = key.value ? loadLocalDraft(key.value) : null;
    if (local) {
      state.fm = local.fm;
      state.body = local.body;
      state.hasLocalDraft = true;
      state.localSavedAt = new Date(local.updatedAt);
      state.status = "local";
    } else {
      state.fm = serverFm;
      state.body = serverBody;
    }
  } catch (err) {
    state.loadError = err instanceof Error ? err.message : String(err);
  } finally {
    state.loading = false;
  }
});

function discardLocalDraft(): void {
  if (key.value) deleteLocalDraft(key.value);
  state.fm = { ...state.serverSnapshot.fm };
  state.body = state.serverSnapshot.body;
  state.hasLocalDraft = false;
  state.localSavedAt = null;
  state.status = "idle";
}

// --- Local autosave + push ------------------------------------------------

let localTimer: number | undefined;
let pushTimer: number | undefined;

watch(
  () => [state.body, JSON.stringify(state.fm)] as const,
  () => {
    if (state.loading || state.loadError) return;
    const snap = snapshot();
    if (snap === state.baseline) {
      state.status = "idle";
      window.clearTimeout(localTimer);
      window.clearTimeout(pushTimer);
      return;
    }
    window.clearTimeout(localTimer);
    localTimer = window.setTimeout(() => {
      if (key.value)
        saveLocalDraft(key.value, { body: state.body, fm: state.fm, updatedAt: Date.now() });
      state.localSavedAt = new Date();
      state.status = "local";
    }, 400);
    if (settings.autoSaveToGitHub) {
      window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(
        () => void pushNow(defaultCommitMessage()),
        CMS_CONFIG.autosaveMs,
      );
    }
  },
);

onBeforeUnmount(() => {
  window.clearTimeout(localTimer);
  window.clearTimeout(pushTimer);
});

async function pushNow(message: string): Promise<void> {
  const repo = target.value;
  if (!repo || state.loading || state.loadError || state.status === "pushing") return;
  state.status = "pushing";
  state.error = "";
  try {
    const client = githubClient();
    state.baseBranch = state.baseBranch || (await ensureDefaultBranch(client));
    await client.createBranch(repo, state.baseBranch, state.branch);
    state.fileSha = await client.putFile(
      repo,
      state.branch,
      state.repoPath,
      serializePost(state.fm, state.body),
      message,
      state.fileSha,
    );
    state.baseline = snapshot();
    state.pushedAt = new Date();
    state.status = "pushed";
    state.isNew = false;
    if (key.value) deleteLocalDraft(key.value);
    state.hasLocalDraft = false;
    if (pendingAfterPush.value === "pr") {
      pendingAfterPush.value = null;
      await openPr();
    }
  } catch (err) {
    state.status = "error";
    state.error = err instanceof Error ? err.message : String(err);
    pendingAfterPush.value = null;
  }
}

const showPushDialog = ref(false);
const pendingAfterPush = ref<"pr" | null>(null);

function requestPush(): void {
  if (!dirty.value) return;
  showPushDialog.value = true;
}

async function openPr(): Promise<void> {
  const repo = target.value;
  if (!repo || state.status === "pushing") return;
  if (dirty.value) {
    pendingAfterPush.value = "pr";
    showPushDialog.value = true;
    return;
  }
  state.error = "";
  try {
    const client = githubClient();
    state.baseBranch = state.baseBranch || (await ensureDefaultBranch(client));
    const body = [
      "Draft post created with WriteShare.",
      "",
      `- File: \`${state.repoPath}\``,
      `- Branch: \`${state.branch}\``,
      "",
      "Review and merge when ready.",
    ].join("\n");
    state.prUrl =
      (await client.findOpenPrUrl(repo, state.branch)) ??
      (await client.createPr(repo, state.baseBranch, state.branch, `post: ${title.value}`, body));
    window.open(state.prUrl, "_blank", "noopener");
  } catch (err) {
    state.status = "error";
    state.error = err instanceof Error ? err.message : String(err);
  }
}

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const statusLabel = computed(() => {
  switch (state.status) {
    case "pushing":
      return "Pushing";
    case "pushed":
      return state.pushedAt ? `Pushed at ${clock(state.pushedAt)}` : "Pushed";
    case "local":
      return state.localSavedAt
        ? `Saved here at ${clock(state.localSavedAt)}`
        : "Saved in this browser";
    case "error":
      return "Push failed";
    default:
      return "No changes";
  }
});

const sealTone = computed(() => {
  switch (state.status) {
    case "pushed":
      return "ok";
    case "error":
      return "danger";
    case "idle":
      return "hollow";
    default:
      return "";
  }
});
</script>

<template>
  <div class="page">
    <p v-if="state.loading" class="muted loading">Loading the post...</p>
    <div v-else-if="state.loadError" class="notice">
      <span>
        {{ state.loadError }} On a private repo, sign out and back in so your token gets the repo scope.
        <a href="#/posts">Back to posts</a>
      </span>
    </div>

    <template v-else-if="cfg">
      <div class="topbar">
        <button class="quiet back-btn" @click="void router.push('/posts')">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M9.78 3.72a.75.75 0 0 1 0 1.06L6.56 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L4.44 8.53a.75.75 0 0 1 0-1.06l4.28-4.28a.75.75 0 0 1 1.06.53z"
            />
          </svg>
          Posts
        </button>
        <span class="context crumbs" :title="state.repoPath">
          <span class="path truncate">{{ crumbs }}</span>
          <span class="context-sep">on</span>
          <a class="branch-link" :href="branchUrl" target="_blank" rel="noreferrer">{{ state.branch }}</a>
        </span>
        <span class="bar-gap" />
        <span class="save-state" :class="`is-${state.status}`">
          <span class="seal" :class="sealTone" aria-hidden="true" />
          {{ statusLabel }}
        </span>
        <div v-if="cfg.components.length" class="insert-menu">
          <button class="quiet" :aria-expanded="insertOpen" @click="insertOpen = !insertOpen">Insert</button>
          <div v-if="insertOpen" class="menu-backdrop" @click="insertOpen = false" />
          <div v-if="insertOpen" class="menu-panel insert-panel">
            <button
              v-for="c in cfg.components"
              :key="c.name"
              class="menu-item"
              :title="c.description ?? c.name"
              @click="insertComponent(c.insert)"
            >
              <span class="insert-label">{{ c.label }}</span>
              <span v-if="c.description" class="insert-desc">{{ c.description }}</span>
            </button>
          </div>
        </div>
        <ThemeToggle />
        <button class="push-btn" :disabled="!dirty || state.status === 'pushing'" @click="requestPush">
          {{ state.status === "pushing" ? "Pushing" : "Push" }}
        </button>
        <button
          v-if="!onDefaultBranch"
          class="primary pr-btn"
          :disabled="state.status === 'pushing'"
          @click="void openPr()"
        >
          {{ state.prUrl ? "View PR" : "Open PR" }}
        </button>
      </div>

      <div v-if="state.status === 'error'" class="notice"><span>{{ state.error }}</span></div>
      <div v-else-if="state.hasLocalDraft" class="notice info">
        <span>
          Picked up the draft saved in this browser{{
            state.localSavedAt ? ` on ${state.localSavedAt.toLocaleString()}` : ""
          }}. Push it to the branch, or
          <button class="link-btn" @click="discardLocalDraft">discard the local changes</button>.
        </span>
      </div>

      <MetadataPanel v-model="state.fm" :fields="cfg.fields" :slug="slug" :url-template="cfg.urlTemplate" />
      <MarkdownEditor ref="editorRef" v-model="state.body" />

      <PushDialog
        :open="showPushDialog"
        :default-message="defaultCommitMessage()"
        :file-path="state.repoPath"
        :branch="state.branch"
        :pushing="state.status === 'pushing'"
        @confirm="
          showPushDialog = false;
          void pushNow($event);
        "
        @cancel="
          showPushDialog = false;
          pendingAfterPush = null;
        "
      />
    </template>
  </div>
</template>

<style scoped>
.loading {
  padding: 3rem 0;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  padding-left: 0.5rem;
}

.crumbs {
  min-width: 0;
}

.path {
  min-width: 4ch;
}

.branch-link {
  flex-shrink: 0;
  color: var(--ink-muted);
}

.branch-link:hover {
  color: var(--accent);
}

.save-state {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: var(--ink-muted);
  white-space: nowrap;
}

.save-state.is-error {
  color: var(--danger);
}

.pr-btn,
.push-btn {
  flex-shrink: 0;
}

.insert-menu {
  position: relative;
  flex-shrink: 0;
}

.insert-panel {
  right: 0;
}

.insert-label {
  font-weight: 500;
}

.insert-desc {
  font-size: 0.8125rem;
  color: var(--ink-muted);
}

.link-btn {
  display: inline;
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  font-size: inherit;
  font-weight: 400;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link-btn:hover:not(:disabled) {
  background: transparent;
  box-shadow: none;
  color: var(--ink);
}

@media (max-width: 720px) {
  .crumbs {
    order: 3;
    max-width: 100%;
  }
}
</style>
