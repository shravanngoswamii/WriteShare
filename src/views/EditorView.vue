<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarkdownEditor from "@/components/MarkdownEditor.vue";
import MetadataPanel from "@/components/MetadataPanel.vue";
import PushDialog from "@/components/PushDialog.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { CMS_CONFIG } from "@/config";
import { parsePost, serializePost } from "@/lib/frontmatter";
import { permalinkFor } from "@/lib/repoconfig";
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
const permalink = computed(() =>
  cfg.value ? permalinkFor(cfg.value.urlTemplate, slug.value) : "",
);

const branchUrl = computed(() =>
  target.value
    ? `https://github.com/${target.value.owner}/${target.value.repo}/tree/${encodeURIComponent(state.branch)}`
    : "#",
);

const crumbs = computed(() => {
  const r = target.value;
  if (!r || !state.repoPath) return "";
  const rel = state.repoPath.startsWith(`${r.contentPath}/`)
    ? state.repoPath.slice(r.contentPath.length + 1)
    : state.repoPath;
  return `${r.owner}/${r.repo} | ${rel}`;
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

const statusLabel = computed(() => {
  switch (state.status) {
    case "pushing":
      return "Pushing...";
    case "pushed":
      return state.pushedAt
        ? `Pushed ${state.pushedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "Pushed";
    case "local":
      return state.localSavedAt
        ? `Saved locally ${state.localSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "Saved locally";
    case "error":
      return "Push failed";
    default:
      return "No changes";
  }
});
</script>

<template>
  <div class="page editor-page">
    <p v-if="state.loading" class="muted">Loading...</p>
    <div v-else-if="state.loadError" class="banner">
      {{ state.loadError }}. On a private repo, sign out and sign in again so your token gets the repo scope.
      <a href="#/posts">back to posts</a>
    </div>

    <template v-else-if="cfg">
      <div class="topbar">
        <button class="back-btn" @click="void router.push('/posts')">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M10.354 3.146a.5.5 0 0 1 0 .708L6.207 8l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0z"
            />
          </svg>
          Posts
        </button>
        <span class="crumbs muted" :title="crumbs">{{ crumbs }}</span>
        <a class="chip" :href="branchUrl" target="_blank" rel="noreferrer">{{ state.branch }}</a>
        <span class="status" :class="`status-${state.status}`">
          <span class="dot" aria-hidden="true" />{{ statusLabel }}
        </span>
        <div v-if="cfg.components.length" class="insert-menu">
          <button class="insert-btn" :aria-expanded="insertOpen" @click="insertOpen = !insertOpen">Insert</button>
          <div v-if="insertOpen" class="insert-backdrop" @click="insertOpen = false" />
          <div v-if="insertOpen" class="insert-panel">
            <button
              v-for="c in cfg.components"
              :key="c.name"
              class="insert-item"
              :title="c.description ?? c.name"
              @click="insertComponent(c.insert)"
            >
              <span class="insert-label">{{ c.label }}</span>
              <span v-if="c.description" class="insert-desc">{{ c.description }}</span>
            </button>
          </div>
        </div>
        <ThemeToggle />
        <button class="push-btn" :disabled="!dirty || state.status === 'pushing'" @click="requestPush">Push</button>
        <button
          v-if="!onDefaultBranch"
          class="primary pr-btn"
          :disabled="state.status === 'pushing'"
          @click="void openPr()"
        >
          {{ state.prUrl ? "View PR" : "Open PR" }}
        </button>
        <span v-else class="chip" title="Commits go straight to the default branch">default branch</span>
      </div>

      <div v-if="state.status === 'error'" class="banner">{{ state.error }}</div>
      <div v-else-if="state.hasLocalDraft" class="banner info">
        Restored a local draft{{ state.localSavedAt ? ` from ${state.localSavedAt.toLocaleString()}` : "" }}. Push to
        save it, or
        <button class="link-btn" @click="discardLocalDraft">discard local changes</button>.
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
.back-btn {
  flex-shrink: 0;
}

.crumbs {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--ink-muted);
  white-space: nowrap;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-muted);
}

.status-local .dot,
.status-pushing .dot {
  background: var(--accent);
}

.status-pushed .dot {
  background: var(--ok);
}

.status-error .dot {
  background: var(--danger);
}

.status-error {
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

.insert-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.insert-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 50;
  min-width: 220px;
  background: var(--paper);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  padding: 0.35rem;
  display: grid;
  gap: 0.15rem;
}

.insert-item {
  display: grid;
  gap: 0.1rem;
  text-align: left;
  background: transparent;
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.7rem;
}

.insert-item:hover:not(:disabled) {
  background: var(--fill);
}

.insert-item:active:not(:disabled) {
  transform: none;
}

.insert-label {
  font-size: 0.9rem;
  font-weight: 500;
}

.insert-desc {
  font-size: 0.78rem;
  color: var(--ink-muted);
}

.link-btn {
  background: transparent;
  padding: 0;
  color: var(--accent);
  text-decoration: underline;
  border-radius: 4px;
}

.link-btn:active:not(:disabled) {
  transform: none;
}
</style>
