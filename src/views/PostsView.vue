<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import ThemeToggle from "@/components/ThemeToggle.vue";
import TreeRail from "@/components/TreeRail.vue";
import { auth, githubClient, logout } from "@/stores/auth";
import { listLocalDrafts } from "@/stores/drafts";
import { postsState, refreshPosts } from "@/stores/posts";
import { activeRepo, refreshRepoConfig } from "@/stores/repos";

const router = useRouter();
const filter = ref("");
const newPost = reactive({ title: "", folder: "" });
const composing = ref(false);
const selectedFolder = ref("");
const branchMenuOpen = ref(false);
const draftBranches = ref<string[]>([]);

const target = computed(() => activeRepo());
const currentBranch = computed(
  () => target.value?.workingBranch || target.value?.defaultBranch || "main",
);

async function toggleBranchMenu(): Promise<void> {
  branchMenuOpen.value = !branchMenuOpen.value;
  const t = target.value;
  if (branchMenuOpen.value && t) {
    draftBranches.value = await githubClient()
      .listBranches(t, "draft/")
      .catch(() => []);
  }
}

async function chooseBranch(branch: string): Promise<void> {
  const t = target.value;
  if (!t) return;
  t.workingBranch = branch || undefined;
  branchMenuOpen.value = false;
  await refreshPosts();
}

onMounted(async () => {
  const repo = target.value;
  if (!repo) {
    void router.push("/repos");
    return;
  }
  if (!auth.user) {
    try {
      auth.user = await githubClient().user();
    } catch {
      // A broken token surfaces as a list error below, which is clearer.
    }
  }
  await refreshPosts();
  if (!repo.configCheckedAt) {
    void refreshRepoConfig(githubClient(), repo).catch(() => {});
  }
});

const drafts = computed(() => new Set(listLocalDrafts().map((d) => d.repoPath)));

const entries = computed(() => {
  const contentPath = target.value?.contentPath ?? "";
  const q = filter.value.trim().toLowerCase();
  return postsState.files
    .map((path) => {
      const rel = path.slice(contentPath.length + 1);
      const parts = rel.split("/");
      const file = parts.pop() ?? rel;
      return { path, name: file.replace(/\.mdx?$/i, ""), folder: parts.join("/") };
    })
    .filter((e) => {
      const rel = (e.folder ? `${e.folder}/` : "") + e.name;
      if (selectedFolder.value && !rel.startsWith(`${selectedFolder.value}/`)) return false;
      return !q || e.name.toLowerCase().includes(q) || e.folder.toLowerCase().includes(q);
    });
});

const folders = computed(() =>
  [...new Set(entries.value.map((e) => e.folder))].filter(Boolean).sort(),
);

/** 404 usually means a private repo hidden from an under-scoped token. */
const scopeHint = computed(() => {
  if (postsState.errorStatus !== 404) return "";
  if (
    !auth.scopes ||
    auth.scopes
      .split(",")
      .map((s) => s.trim())
      .includes("repo")
  )
    return "";
  return "This repo may be private and your token only has public_repo. Sign out and sign in again to grant the repo scope.";
});

function openEntry(path: string): void {
  void router.push({
    path: "/edit",
    query: { path, ...(target.value?.workingBranch ? { branch: target.value.workingBranch } : {}) },
  });
}

function createNew(): void {
  if (!newPost.title.trim()) return;
  void router.push({
    path: "/edit",
    query: {
      new: "1",
      title: newPost.title.trim(),
      folder: newPost.folder.trim() || selectedFolder.value,
    },
  });
}

function signOut(): void {
  logout();
  void router.push("/login");
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <h1 class="large-title">Posts</h1>
      <button class="repo-chip" title="Repositories" @click="void router.push('/repos')">
        {{ target ? `${target.owner}/${target.repo}` : "No repository" }}
      </button>
      <div class="branch-menu">
        <button class="repo-chip" :aria-expanded="branchMenuOpen" title="Working branch" @click="void toggleBranchMenu()">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0zM8 5.75A.75.75 0 0 0 8 4.25v1.5zM7.25 8a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM5 8.75a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 0 0-4.5 0zm-2.25.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM8 11.25a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z"
            />
          </svg>
          {{ currentBranch }}
        </button>
        <div v-if="branchMenuOpen" class="menu-backdrop" @click="branchMenuOpen = false" />
        <div v-if="branchMenuOpen" class="menu-panel">
          <button class="menu-item" :disabled="!target?.workingBranch" @click="void chooseBranch('')">
            <span class="menu-label">{{ target?.defaultBranch ?? "main" }}</span>
            <span class="menu-sub">default</span>
          </button>
          <p v-if="!draftBranches.length" class="menu-empty">No draft branches</p>
          <button v-for="b in draftBranches" :key="b" class="menu-item" @click="void chooseBranch(b)">
            <span class="menu-label">{{ b }}</span>
            <span v-if="b === target?.workingBranch" class="menu-sub">current</span>
          </button>
        </div>
      </div>
      <ThemeToggle />
      <img
        v-if="auth.user"
        class="avatar"
        :src="auth.user.avatar_url"
        :alt="auth.user.login"
        width="30"
        height="30"
      />
      <button class="quiet" @click="signOut">Sign out</button>
    </div>

    <div class="explorer">
      <TreeRail
        v-if="target"
        :files="postsState.files"
        :root="target.contentPath"
        :selected="selectedFolder"
        @select="selectedFolder = $event"
      />

      <div class="listing">
        <div class="search-row">
          <svg class="icon search-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.867-3.834zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"
            />
          </svg>
          <input v-model="filter" class="search" type="search" placeholder="Search" />
          <button class="primary new-btn" @click="composing = !composing">New post</button>
        </div>

        <div v-if="composing" class="composer">
          <input
            v-model="newPost.title"
            type="text"
            placeholder="Post title"
            autofocus
            @keydown.enter="createNew"
          />
          <input
            v-model="newPost.folder"
            type="text"
            :placeholder="selectedFolder || 'Folder (optional)'"
            list="folders"
            @keydown.enter="createNew"
          />
          <datalist id="folders">
            <option v-for="f in folders" :key="f" :value="f" />
          </datalist>
          <div class="composer-actions">
            <button class="quiet" @click="composing = false">Cancel</button>
            <button class="primary" :disabled="!newPost.title.trim()" @click="createNew">Start writing</button>
          </div>
        </div>

        <div v-if="postsState.error" class="banner">
          {{ postsState.error }}
          <p v-if="scopeHint" class="hint">{{ scopeHint }}</p>
        </div>
        <p v-else-if="postsState.loading" class="muted list-note">Loading...</p>
        <p v-else class="muted list-note small">
          {{ entries.length }} files in
          {{ selectedFolder ? `${target?.contentPath}/${selectedFolder}` : target?.contentPath }}
        </p>

        <div class="grouped">
          <button v-for="e in entries" :key="e.path" class="row" @click="openEntry(e.path)">
            <span v-if="drafts.has(e.path)" class="draft-dot" title="Unsaved local draft" aria-label="unsaved local draft" />
            <span class="row-text">
              <span class="row-name">{{ e.name }}</span>
              <span v-if="e.folder" class="row-sub">{{ e.folder }}</span>
            </span>
            <svg class="icon chevron" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M5.646 3.646a.5.5 0 0 1 .708 0l5 5a.5.5 0 0 1 0 .708l-5 5a.5.5 0 0 1-.708-.708L10.293 8 5.646 4.354a.5.5 0 0 1 0-.708z"
              />
            </svg>
          </button>
          <p v-if="!entries.length && !postsState.loading" class="muted empty">Nothing here.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar {
  border-radius: 50%;
  display: block;
}

.quiet {
  font-size: 0.9rem;
  padding: 0.45rem 0.9rem;
}

.repo-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: var(--ink-muted);
  padding: 0.35rem 0.8rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.branch-menu {
  position: relative;
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.menu-panel {
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  z-index: 50;
  min-width: 220px;
  max-height: 300px;
  overflow: auto;
  background: var(--paper);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
  padding: 0.35rem;
  display: grid;
  gap: 0.15rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
  background: transparent;
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}

.menu-item:hover:not(:disabled) {
  background: var(--fill);
}

.menu-item:active:not(:disabled) {
  transform: none;
}

.menu-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-sub {
  font-size: 0.72rem;
  color: var(--ink-muted);
}

.menu-empty {
  margin: 0.4rem 0.7rem;
  font-size: 0.8rem;
  color: var(--ink-muted);
}

.explorer {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.listing {
  min-width: 0;
}

.search-row {
  position: relative;
  margin-bottom: 0.75rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.9rem;
  color: var(--ink-muted);
  pointer-events: none;
}

.search {
  padding-left: 2.4rem;
  border-radius: 999px;
}

.new-btn {
  flex-shrink: 0;
}

.composer {
  background: var(--paper);
  border-radius: var(--radius-lg);
  padding: 1rem;
  margin-bottom: 1rem;
  display: grid;
  gap: 0.6rem;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.list-note {
  margin: 0.25rem 0.15rem 0.75rem;
}

.hint {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
}

.grouped {
  background: var(--paper);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  background: transparent;
  border-radius: 0;
  padding: 0.85rem 1.15rem;
  transition: background-color 0.1s ease;
}

.row + .row {
  border-top: 1px solid var(--separator);
}

.row:hover:not(:disabled) {
  background: var(--fill);
}

.row:active:not(:disabled) {
  transform: none;
}

.draft-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.row-text {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.1rem;
}

.row-name {
  font-weight: 500;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-sub {
  font-size: 0.8rem;
  color: var(--ink-muted);
}

.chevron {
  color: var(--ink-muted);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.empty {
  padding: 1rem 1.15rem;
  margin: 0;
}

@media (max-width: 800px) {
  .explorer {
    grid-template-columns: 1fr;
  }
}
</style>
