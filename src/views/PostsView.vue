<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { auth, githubClient, logout } from "@/stores/auth";
import { postsState, refreshPosts } from "@/stores/posts";
import { activeRepo } from "@/stores/repos";

const router = useRouter();
const filter = ref("");
const newPost = reactive({ title: "", folder: "" });
const composing = ref(false);

const target = computed(() => activeRepo());

onMounted(async () => {
  if (!target.value) {
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
});

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
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.folder.toLowerCase().includes(q));
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
  void router.push({ path: "/edit", query: { path } });
}

function createNew(): void {
  if (!newPost.title.trim()) return;
  void router.push({
    path: "/edit",
    query: { new: "1", title: newPost.title.trim(), folder: newPost.folder.trim() },
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
      <button class="repo-chip" title="Switch repository" @click="void router.push('/repos')">
        {{ target ? `${target.owner}/${target.repo}` : "No repository" }}
      </button>
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

    <div class="search-row">
      <svg class="icon search-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.867-3.834zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"
        />
      </svg>
      <input v-model="filter" class="search" type="search" placeholder="Search" />
    </div>

    <div v-if="composing" class="composer">
      <input v-model="newPost.title" type="text" placeholder="Post title" autofocus @keydown.enter="createNew" />
      <input
        v-model="newPost.folder"
        type="text"
        placeholder="Folder (optional)"
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
      {{ entries.length }} files in {{ target?.contentPath }} of {{ target?.owner }}/{{ target?.repo }}
    </p>

    <div class="grouped">
      <button v-for="e in entries" :key="e.path" class="row" @click="openEntry(e.path)">
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
    </div>

    <button class="fab primary" title="New post" @click="composing = !composing">
      <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 1.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 8 1.5z"
        />
      </svg>
    </button>
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
}

.search-row {
  position: relative;
  margin-bottom: 0.75rem;
}

.search-icon {
  position: absolute;
  left: 0.9rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--ink-muted);
  pointer-events: none;
}

.search {
  padding-left: 2.4rem;
  border-radius: 999px;
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

.fab {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 1.2rem;
}
</style>
