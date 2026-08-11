<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarkdownEditor from "@/components/MarkdownEditor.vue";
import MetadataRail from "@/components/MetadataRail.vue";
import PushDialog from "@/components/PushDialog.vue";
import { CMS_CONFIG } from "@/config";
import { parsePost, serializePost } from "@/lib/frontmatter";
import { draftBranchFor, kebab } from "@/lib/slug";
import { applyTemplate, DEFAULT_COMMIT_TEMPLATE } from "@/lib/template";
import { githubClient } from "@/stores/auth";
import { deleteLocalDraft, draftKey, loadLocalDraft, saveLocalDraft } from "@/stores/drafts";
import { prForBranch, refreshPipeline, rememberPr } from "@/stores/pipeline";
import { refreshPosts } from "@/stores/posts";
import { activeRepo, ensureDefaultBranch, resolveConfig } from "@/stores/repos";
import { settings } from "@/stores/settings";
import { notify } from "@/stores/toasts";

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
  pushedAt: null as Date | null,
  localSavedAt: null as Date | null,
  baseBranch: "",
  baseline: "",
  hasLocalDraft: false,
  serverSnapshot: { body: "", fm: {} as Record<string, unknown> },
});

const metaOpen = ref(true);
const insertOpen = ref(false);
const showPushDialog = ref(false);
const pendingAfterPush = ref<"pr" | null>(null);
const editorRef = ref<{ insertSnippet: (text: string) => void } | null>(null);

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
const pr = computed(() => prForBranch(state.branch));

const branchUrl = computed(() =>
  target.value
    ? `https://github.com/${target.value.owner}/${target.value.repo}/tree/${encodeURIComponent(state.branch)}`
    : "#",
);

const relPath = computed(() => {
  const r = target.value;
  if (!r) return state.repoPath;
  return state.repoPath.startsWith(`${r.contentPath}/`)
    ? state.repoPath.slice(r.contentPath.length + 1)
    : state.repoPath;
});

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const savedLabel = computed(() => {
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

/**
 * The one thing to do next. Writing, pushing and opening a pull request are
 * three separate GitHub operations, so the flow says which one is due.
 */
type Stage = "direct" | "unsaved" | "pushed" | "review";

const stage = computed<Stage>(() => {
  if (onDefaultBranch.value) return "direct";
  if (dirty.value) return "unsaved";
  return pr.value ? "review" : "pushed";
});

const stageCopy = computed(() => {
  switch (stage.value) {
    case "direct":
      return {
        label: "Publishing directly",
        text: `Every push commits to ${state.baseBranch} and goes live. Switch to a draft branch in the sidebar to review before publishing.`,
      };
    case "unsaved":
      return {
        label: "Unsaved",
        text: state.hasLocalDraft
          ? "Kept in this browser only. Push to put the changes on the draft branch."
          : `Kept in this browser. Push to commit them to ${state.branch}.`,
      };
    case "pushed":
      return {
        label: "Pushed",
        text: "The draft is on GitHub. Open a pull request when it is ready to be reviewed.",
      };
    default:
      return {
        label: `In review as #${pr.value?.number}`,
        text: "Merging the pull request publishes the post.",
      };
  }
});

function defaultCommitMessage(): string {
  const tpl = settings.commitTemplate || cfg.value?.commitTemplate || DEFAULT_COMMIT_TEMPLATE;
  return applyTemplate(tpl, { action: action.value, path: state.repoPath, title: title.value });
}

onMounted(async () => {
  try {
    const repo = target.value;
    if (!repo) throw new Error("No repository selected. Pick one from the Repositories screen.");
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
    void refreshPipeline();
  } catch (err) {
    state.loadError = err instanceof Error ? err.message : String(err);
  } finally {
    state.loading = false;
  }
  window.addEventListener("keydown", onKey);
});

function onKey(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    requestPush();
  }
}

function discardLocalDraft(): void {
  if (key.value) deleteLocalDraft(key.value);
  state.fm = { ...state.serverSnapshot.fm };
  state.body = state.serverSnapshot.body;
  state.hasLocalDraft = false;
  state.localSavedAt = null;
  state.status = "idle";
  notify("Local changes discarded. Showing the copy from GitHub.");
}

function insertComponent(text: string): void {
  editorRef.value?.insertSnippet(text);
  insertOpen.value = false;
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
  window.removeEventListener("keydown", onKey);
});

function requestPush(): void {
  if (!dirty.value || state.status === "pushing") return;
  showPushDialog.value = true;
}

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
    await Promise.all([refreshPosts(), refreshPipeline(true)]);
    if (pendingAfterPush.value === "pr") {
      pendingAfterPush.value = null;
      await openPr();
    } else if (onDefaultBranch.value) {
      notify(`Committed to ${state.baseBranch}. It is live once your site rebuilds.`, "ok");
    } else {
      notify(`Pushed to ${state.branch}.`, "ok", {
        label: "Open pull request",
        run: () => void openPr(),
      });
    }
  } catch (err) {
    state.status = "error";
    state.error = err instanceof Error ? err.message : String(err);
    pendingAfterPush.value = null;
    notify(state.error, "error");
  }
}

async function openPr(): Promise<void> {
  const repo = target.value;
  if (!repo || state.status === "pushing") return;
  if (dirty.value) {
    pendingAfterPush.value = "pr";
    showPushDialog.value = true;
    return;
  }
  const existing = pr.value;
  if (existing) {
    window.open(existing.html_url, "_blank", "noopener");
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
    const prTitle = `post: ${title.value}`;
    const url =
      (await client.findOpenPrUrl(repo, state.branch)) ??
      (await client.createPr(repo, state.baseBranch, state.branch, prTitle, body));
    rememberPr({
      number: Number(url.split("/").pop()),
      title: prTitle,
      head: { ref: state.branch },
      html_url: url,
      updated_at: new Date().toISOString(),
    });
    notify("Pull request opened. Merge it from Review to publish.", "ok", {
      label: "View on GitHub",
      run: () => window.open(url, "_blank", "noopener"),
    });
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    notify(state.error, "error");
  }
}
</script>

<template>
  <div class="view editor">
    <p v-if="state.loading" class="loading muted">Loading the post...</p>

    <div v-else-if="state.loadError" class="load-error">
      <div class="notice">
        <span>
          {{ state.loadError }}
          <span class="scope-hint">
            On a private repository, sign out and back in so your token carries the repo scope.
          </span>
        </span>
      </div>
      <button @click="void router.push('/posts')">Back to posts</button>
    </div>

    <template v-else-if="cfg">
      <header class="view-header">
        <div class="view-heading">
          <h1 class="view-title truncate">{{ title }}</h1>
          <p class="view-sub">
            <span class="mono">{{ relPath }}</span>
            <span class="sep">on</span>
            <a class="mono branch-link" :href="branchUrl" target="_blank" rel="noreferrer">
              {{ state.branch }}
            </a>
          </p>
        </div>

        <div class="view-actions">
          <span class="saved" :class="{ failed: state.status === 'error' }">{{ savedLabel }}</span>

          <div v-if="cfg.components.length" class="insert-menu">
            <button class="quiet" :aria-expanded="insertOpen" @click="insertOpen = !insertOpen">
              Insert
            </button>
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

          <button class="quiet" :aria-pressed="metaOpen" @click="metaOpen = !metaOpen">
            {{ metaOpen ? "Hide details" : "Details" }}
          </button>
        </div>

        <div class="stage" :class="stage">
        <span class="seal" :class="stage === 'review' ? 'ok' : stage === 'direct' ? 'hollow' : ''" aria-hidden="true" />
        <span class="stage-label">{{ stageCopy.label }}</span>
        <span class="stage-text">{{ stageCopy.text }}</span>

        <span class="stage-actions">
          <button v-if="state.hasLocalDraft" class="quiet" @click="discardLocalDraft">
            Discard local changes
          </button>
          <button
            v-if="stage === 'unsaved' || stage === 'direct'"
            class="primary"
            :disabled="!dirty || state.status === 'pushing'"
            @click="requestPush"
          >
            {{ state.status === "pushing" ? "Pushing" : "Push" }}
          </button>
          <button v-else-if="stage === 'pushed'" class="primary" @click="void openPr()">
            Open pull request
          </button>
          <template v-else-if="stage === 'review'">
            <button class="quiet" @click="void router.push('/review')">Go to Review</button>
            <button class="primary" @click="void openPr()">View pull request</button>
          </template>
        </span>
        </div>
      </header>

      <div v-if="state.status === 'error'" class="notice"><span>{{ state.error }}</span></div>

      <div class="editor-layout" :class="{ 'with-rail': metaOpen }">
        <MarkdownEditor ref="editorRef" v-model="state.body" />
        <MetadataRail
          v-if="metaOpen"
          v-model="state.fm"
          :fields="cfg.fields"
          :slug="slug"
          :url-template="cfg.urlTemplate"
        />
      </div>

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
  padding: 4rem var(--space-gutter);
}

.load-error {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  padding: 2rem var(--space-gutter);
  max-width: 640px;
}

.scope-hint {
  display: block;
  margin-top: 0.35rem;
  color: var(--ink-muted);
}

.view-sub {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.sep {
  color: var(--ink-muted);
  opacity: 0.7;
}

.branch-link {
  color: var(--ink-muted);
}

.branch-link:hover {
  color: var(--accent);
}

.saved {
  font-size: 0.8125rem;
  color: var(--ink-muted);
  white-space: nowrap;
  margin-right: 0.15rem;
}

.saved.failed {
  color: var(--danger);
}

.insert-menu {
  position: relative;
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

/* The publish flow, spelled out: one stage, one next action. Part of the
   sticky header so the action stays reachable while writing. */
.stage {
  flex-basis: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.9rem;
  padding: 0.6rem 0.8rem;
  background: var(--paper);
  border: 1px solid var(--separator);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
}

.stage.unsaved {
  border-color: var(--accent-soft);
  background: var(--accent-soft);
}

.stage-label {
  font-weight: 500;
}

.stage-text {
  flex: 1;
  min-width: 12rem;
  color: var(--ink-soft);
}

.stage-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.notice {
  margin: 0 var(--space-gutter) 1.25rem;
}

.editor-layout {
  display: grid;
  gap: 1.5rem;
  padding: 0 var(--space-gutter) 3rem;
}

.editor-layout.with-rail {
  grid-template-columns: minmax(0, 1fr) minmax(0, 20rem);
}

@media (max-width: 1080px) {
  .editor-layout.with-rail {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
