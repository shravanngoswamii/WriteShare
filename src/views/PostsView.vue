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
      <span v-if="target" class="context">
        <span class="truncate">{{ target.owner }}/{{ target.repo }}</span>
      </span>
      <span class="bar-gap" />
      <div class="branch-menu">
        <button
          class="quiet branch-btn"
          :aria-expanded="branchMenuOpen"
          title="Working branch"
          @click="void toggleBranchMenu()"
        >
          <span class="truncate">{{ currentBranch }}</span>
          <svg class="icon caret" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.22 6.28a.75.75 0 0 1 1.06-.06L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1z" />
          </svg>
        </button>
        <div v-if="branchMenuOpen" class="menu-backdrop" @click="branchMenuOpen = false" />
        <div v-if="branchMenuOpen" class="menu-panel branch-panel">
          <button class="menu-item" :disabled="!target?.workingBranch" @click="void chooseBranch('')">
            <span class="menu-label">{{ target?.defaultBranch ?? "main" }}</span>
            <span class="menu-sub">Default branch</span>
          </button>
          <p v-if="!draftBranches.length" class="menu-empty">No draft branches yet</p>
          <button v-for="b in draftBranches" :key="b" class="menu-item" @click="void chooseBranch(b)">
            <span class="menu-label">{{ b }}</span>
            <span v-if="b === target?.workingBranch" class="menu-sub">Current</span>
          </button>
        </div>
      </div>
      <button class="quiet" title="Repositories" @click="void router.push('/repos')">Repos</button>
      <ThemeToggle />
      <img
        v-if="auth.user"
        class="avatar"
        :src="auth.user.avatar_url"
        :alt="auth.user.login"
        :title="auth.user.login"
        width="26"
        height="26"
      />
      <button class="quiet" @click="signOut">Sign out</button>
    </div>

    <div class="toolbar">
      <input v-model="filter" class="search" type="search" placeholder="Search posts" />
      <button class="primary" @click="composing = !composing">New post</button>
    </div>

    <div v-if="composing" class="block composer">
      <div class="field">
        <label for="new-title">Title</label>
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
        <label for="new-folder">Folder</label>
        <input
          id="new-folder"
          v-model="newPost.folder"
          type="text"
          :placeholder="selectedFolder || 'Optional'"
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

    <div v-if="postsState.error" class="notice">
      <span>
        {{ postsState.error }}
        <span v-if="scopeHint" class="scope-hint">{{ scopeHint }}</span>
      </span>
    </div>

    <div class="explorer">
      <TreeRail
        v-if="target"
        :files="postsState.files"
        :root="target.contentPath"
        :selected="selectedFolder"
        @select="selectedFolder = $event"
      />

      <div class="grouped listing">
        <button v-for="e in entries" :key="e.path" class="row" @click="openEntry(e.path)">
          <span
            v-if="drafts.has(e.path)"
            class="seal"
            title="Unsaved draft in this browser"
            aria-label="unsaved draft"
          />
          <span v-else class="seal-gap" aria-hidden="true" />
          <span class="row-text">
            <span class="row-name">{{ e.name }}</span>
          </span>
          <span v-if="drafts.has(e.path)" class="row-sub unsaved">Unsaved</span>
          <span v-else-if="e.folder" class="row-sub mono">{{ e.folder }}</span>
        </button>

        <p v-if="postsState.loading" class="empty muted">Reading the repository...</p>
        <p v-else-if="!entries.length && filter" class="empty muted">
          Nothing matches "{{ filter }}".
        </p>
        <p v-else-if="!entries.length" class="empty muted">
          No posts in this folder yet. New post starts one.
        </p>
      </div>
    </div>

    <p class="hint count-note">
      {{ entries.length }} {{ entries.length === 1 ? "file" : "files" }} in
      <span class="mono">{{
        selectedFolder ? `${target?.contentPath}/${selectedFolder}` : target?.contentPath
      }}</span>
    </p>
  </div>
</template>

<style scoped>
.avatar {
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
}

.branch-menu {
  position: relative;
  flex-shrink: 0;
}

.branch-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 220px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--ink-soft);
}

.caret {
  color: var(--ink-muted);
  flex-shrink: 0;
}

.branch-panel {
  left: 0;
}

.menu-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.82rem;
}

.menu-sub {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.menu-empty {
  margin: 0;
  padding: 0.5rem 0.6rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}

.toolbar {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

.search {
  flex: 1;
  min-width: 0;
}

.composer {
  margin-bottom: 1.5rem;
  max-width: 520px;
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
  grid-template-columns: minmax(170px, 210px) minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

.listing {
  min-width: 0;
}

.row + .row {
  box-shadow: inset 0 1px 0 var(--separator);
}

.seal-gap {
  width: 6px;
  flex-shrink: 0;
}

.unsaved {
  color: var(--accent);
}

.empty {
  padding: 1.5rem 1rem;
  margin: 0;
  text-align: center;
  font-size: 0.875rem;
}

.count-note {
  margin-top: 1rem;
}

@media (max-width: 760px) {
  .explorer {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
</style>
