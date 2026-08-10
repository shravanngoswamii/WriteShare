<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { StatusItem } from "@/components/StatusLine.vue";
import StatusLine from "@/components/StatusLine.vue";
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
      return { path, name: file, folder: parts.join("/") };
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

const statusItems = computed<StatusItem[]>(() => {
  const t = target.value;
  const items: StatusItem[] = [
    {
      label: "repo",
      value: t ? `${t.owner}/${t.repo}` : "none",
      href: t ? `https://github.com/${t.owner}/${t.repo}` : undefined,
    },
    { label: "branch", value: currentBranch.value },
  ];
  const unsaved = entries.value.filter((e) => drafts.value.has(e.path)).length;
  if (unsaved) items.push({ value: `${unsaved} unsaved`, tone: "busy" });
  return items;
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
      <h1 class="large-title">posts</h1>
      <div class="branch-menu">
        <button
          class="quiet branch-btn"
          :aria-expanded="branchMenuOpen"
          title="Working branch"
          @click="void toggleBranchMenu()"
        >
          {{ currentBranch }}
        </button>
        <div v-if="branchMenuOpen" class="menu-backdrop" @click="branchMenuOpen = false" />
        <div v-if="branchMenuOpen" class="menu-panel branch-panel">
          <button class="menu-item" :disabled="!target?.workingBranch" @click="void chooseBranch('')">
            <span class="menu-label">{{ target?.defaultBranch ?? "main" }}</span>
            <span class="menu-sub">default branch</span>
          </button>
          <p v-if="!draftBranches.length" class="menu-empty">no draft branches yet</p>
          <button v-for="b in draftBranches" :key="b" class="menu-item" @click="void chooseBranch(b)">
            <span class="menu-label">{{ b }}</span>
            <span v-if="b === target?.workingBranch" class="menu-sub">current</span>
          </button>
        </div>
      </div>
      <button class="quiet" title="Repositories" @click="void router.push('/repos')">Repos</button>
      <ThemeToggle />
      <button class="quiet" @click="signOut">Sign out</button>
    </div>

    <div class="toolbar">
      <input v-model="filter" class="search" type="search" placeholder="filter files" />
      <button class="primary" @click="composing = !composing">New post</button>
    </div>

    <div v-if="composing" class="block composer">
      <div class="field">
        <label for="new-title">title</label>
        <input
          id="new-title"
          v-model="newPost.title"
          type="text"
          placeholder="What are you writing?"
          autofocus
          @keydown.enter="createNew"
        />
      </div>
      <div class="field">
        <label for="new-folder">folder</label>
        <input
          id="new-folder"
          v-model="newPost.folder"
          type="text"
          :placeholder="selectedFolder || 'optional'"
          list="folders"
          @keydown.enter="createNew"
        />
        <datalist id="folders">
          <option v-for="f in folders" :key="f" :value="f" />
        </datalist>
      </div>
      <div class="composer-actions">
        <button class="quiet" @click="composing = false">Cancel</button>
        <button class="primary" :disabled="!newPost.title.trim()" @click="createNew">Start writing</button>
      </div>
    </div>

    <div v-if="postsState.error" class="banner">
      {{ postsState.error }}
      <span v-if="scopeHint" class="scope-hint">{{ scopeHint }}</span>
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
        <button v-for="e in entries" :key="e.path" class="row" @click="openEntry(e.path)">
          <span class="mark" :class="{ draft: drafts.has(e.path) }" aria-hidden="true">
            {{ drafts.has(e.path) ? "*" : " " }}
          </span>
          <span class="row-text">
            <span class="row-name">{{ e.name }}</span>
          </span>
          <span v-if="drafts.has(e.path)" class="row-sub">unsaved draft</span>
          <span v-else-if="e.folder" class="row-sub">{{ e.folder }}</span>
        </button>

        <p v-if="postsState.loading" class="empty muted">reading the repo...</p>
        <p v-else-if="!entries.length && filter" class="empty muted">
          nothing matches "{{ filter }}".
        </p>
        <p v-else-if="!entries.length" class="empty muted">
          no files here yet. New post starts one.
        </p>
      </div>
    </div>

    <p class="hint count-note">
      {{ entries.length }} files in
      {{ selectedFolder ? `${target?.contentPath}/${selectedFolder}` : target?.contentPath }}
    </p>

    <StatusLine mode="posts" :items="statusItems" :user="auth.user" />
  </div>
</template>

<style scoped>
.branch-menu {
  position: relative;
  flex-shrink: 0;
}

.branch-btn {
  text-transform: none;
  letter-spacing: 0.02em;
  color: var(--ink-muted);
}

.branch-btn:hover:not(:disabled) {
  color: var(--canvas);
}

.branch-panel {
  left: 0;
}

.menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-sub {
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.menu-item:hover .menu-sub {
  color: var(--canvas);
}

.menu-empty {
  margin: 0;
  padding: 0.45rem 0.6rem;
  border-top: var(--hair) solid var(--separator);
  font-size: 0.78rem;
  color: var(--ink-muted);
}

.toolbar {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  margin-bottom: 1rem;
}

.search {
  flex: 1;
  min-width: 0;
}

.search::-webkit-search-cancel-button {
  filter: grayscale(1);
}

.composer {
  margin-bottom: 1rem;
  max-width: 560px;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.scope-hint {
  display: block;
  margin-top: 0.35rem;
  color: var(--ink-muted);
}

.explorer {
  display: grid;
  grid-template-columns: minmax(180px, 230px) minmax(0, 1fr);
  border: var(--edge) solid var(--ink);
  background: var(--paper);
}

.listing {
  min-width: 0;
}

.row + .row {
  border-top: var(--hair) solid var(--separator);
}

.mark {
  width: 1ch;
  color: var(--accent);
  flex-shrink: 0;
  white-space: pre;
}

.row:hover .mark.draft {
  color: var(--canvas);
}

.empty {
  padding: 0.9rem 0.7rem;
  margin: 0;
}

.count-note {
  margin: 0.6rem 0 0;
}

@media (max-width: 760px) {
  .explorer {
    grid-template-columns: 1fr;
  }
}
</style>
