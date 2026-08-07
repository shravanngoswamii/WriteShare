<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import FrontmatterForm from "@/components/FrontmatterForm.vue";
import MarkdownEditor from "@/components/MarkdownEditor.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { BLOG_COLLECTION, CMS_CONFIG } from "@/config";
import { parsePost, serializePost } from "@/lib/frontmatter";
import { draftBranchFor, kebab } from "@/lib/slug";
import { githubClient } from "@/stores/auth";
import { activeRepo, ensureDefaultBranch } from "@/stores/repos";

const route = useRoute();
const router = useRouter();
const collection = BLOG_COLLECTION;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const state = reactive({
  loading: true,
  loadError: "",
  isNew: route.query.new === "1",
  repoPath: "",
  branch: "",
  fileSha: undefined as string | undefined,
  fm: { ...collection.template } as Record<string, unknown>,
  body: "",
  save: "idle" as SaveState,
  error: "",
  prUrl: null as string | null,
  savedAt: null as Date | null,
  baseBranch: "",
});

const target = computed(() => activeRepo());
const title = computed(() => String(state.fm.title ?? "") || "Untitled");
const branchUrl = computed(() =>
  target.value
    ? `https://github.com/${target.value.owner}/${target.value.repo}/tree/${encodeURIComponent(state.branch)}`
    : "#",
);

onMounted(async () => {
  try {
    const repo = target.value;
    if (!repo) throw new Error("No repository selected. Pick one from the repositories screen.");
    if (state.isNew) {
      const rawTitle = String(route.query.title ?? "Untitled");
      const folder = String(route.query.folder ?? "").replace(/^\/+|\/+$/g, "");
      const dir = folder ? `${repo.contentPath}/${folder}` : repo.contentPath;
      state.repoPath = `${dir}/${kebab(rawTitle)}${collection.extension}`;
      state.branch = draftBranchFor(state.repoPath);
      state.fm = { ...collection.template, title: rawTitle, pubDatetime: new Date().toISOString() };
      state.body = "";
      state.save = "dirty";
    } else {
      const path = String(route.query.path ?? "");
      if (!path) throw new Error("Nothing to edit. Open a post from the list.");
      state.repoPath = path;
      state.branch = draftBranchFor(path);
      const client = githubClient();
      state.baseBranch = await ensureDefaultBranch(client);
      // Resume the draft branch if it already holds this file; else read the published version.
      const draft = await client.getFile(repo, state.branch, path).catch(() => null);
      const base = draft ? null : await client.getFile(repo, state.baseBranch, path);
      const source = draft ?? base;
      if (!source) throw new Error(`File not found: ${path}`);
      state.fileSha = draft?.sha; // only same-branch shas are valid for updates
      const parsed = parsePost(source.content);
      state.fm = { ...collection.template, ...parsed.data };
      state.body = parsed.body;
    }
  } catch (err) {
    state.loadError = err instanceof Error ? err.message : String(err);
  } finally {
    state.loading = false;
  }
});

let timer: number | undefined;
watch(
  () => [state.body, JSON.stringify(state.fm)] as const,
  () => {
    if (state.loading || state.loadError) return;
    state.save = "dirty";
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void saveNow(), CMS_CONFIG.autosaveMs);
  },
);

onBeforeUnmount(() => window.clearTimeout(timer));

async function saveNow(): Promise<void> {
  if (state.loading || state.loadError || state.save === "saving") return;
  const repo = target.value;
  if (!repo) return;
  state.save = "saving";
  state.error = "";
  try {
    const client = githubClient();
    state.baseBranch = state.baseBranch || (await ensureDefaultBranch(client));
    await client.createBranch(repo, state.baseBranch, state.branch); // no-op once it exists
    const verb = state.fileSha ? "Update" : "Create";
    state.fileSha = await client.putFile(
      repo,
      state.branch,
      state.repoPath,
      serializePost(state.fm, state.body),
      `${verb} ${state.repoPath} (via WriteShare)`,
      state.fileSha,
    );
    state.save = "saved";
    state.savedAt = new Date();
  } catch (err) {
    state.save = "error";
    state.error = err instanceof Error ? err.message : String(err);
  }
}

async function openPr(): Promise<void> {
  const repo = target.value;
  if (!repo) return;
  state.error = "";
  try {
    if (state.save === "dirty" || state.save === "error") await saveNow();
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
    state.save = "error";
    state.error = err instanceof Error ? err.message : String(err);
  }
}

const statusLabel = computed(() => {
  switch (state.save) {
    case "saving":
      return "Saving...";
    case "saved":
      return state.savedAt
        ? `Saved ${state.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "Saved";
    case "error":
      return "Save failed";
    default:
      return "Unsaved";
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

    <template v-else>
      <div class="topbar">
        <button class="back-btn" @click="void router.push('/posts')">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M10.354 3.146a.5.5 0 0 1 0 .708L6.207 8l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0z"
            />
          </svg>
          Posts
        </button>
        <h1 class="large-title editor-title">{{ title }}</h1>
        <a class="chip" :href="branchUrl" target="_blank" rel="noreferrer">{{ state.branch }}</a>
        <span class="status" :class="`status-${state.save}`">
          <span class="dot" aria-hidden="true" />{{ statusLabel }}
        </span>
        <ThemeToggle />
        <button class="primary pr-btn" :disabled="state.save === 'saving'" @click="void openPr()">
          {{ state.prUrl ? "View PR" : "Open PR" }}
        </button>
      </div>

      <div v-if="state.save === 'error'" class="banner">{{ state.error }}</div>

      <div class="editor-grid">
        <aside class="meta-panel">
          <FrontmatterForm v-model="state.fm" :fields="collection.fields" />
          <p class="muted small">File</p>
          <p class="chip path-chip">{{ state.repoPath }}</p>
          <button class="save-btn" :disabled="state.save === 'saving'" @click="void saveNow()">Save now</button>
        </aside>
        <MarkdownEditor v-model="state.body" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.editor-title {
  font-size: 1.05rem;
  font-weight: 600;
}

.back-btn {
  flex-shrink: 0;
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

.status-saving .dot {
  background: var(--accent);
}

.status-saved .dot {
  background: var(--ok);
}

.status-error .dot {
  background: var(--danger);
}

.status-error {
  color: var(--danger);
}

.pr-btn {
  flex-shrink: 0;
}

.editor-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.meta-panel {
  background: var(--paper);
  border-radius: var(--radius-lg);
  padding: 1.15rem;
  position: sticky;
  top: 4.5rem;
}

.path-chip {
  display: block;
  word-break: break-all;
  margin-top: 0.25rem;
  margin-bottom: 1rem;
}

.save-btn {
  width: 100%;
}

@media (max-width: 880px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }

  .meta-panel {
    position: static;
  }
}
</style>
