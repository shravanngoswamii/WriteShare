<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { auth, githubClient } from "@/stores/auth";
import { listLocalDrafts } from "@/stores/drafts";
import { postsState, refreshPosts } from "@/stores/posts";
import { activeRepo } from "@/stores/repos";

const route = useRoute();
const router = useRouter();

const filter = ref("");
const onlyUnsaved = ref(false);
const newPost = reactive({ title: "", folder: "" });
const composing = ref(false);
const searchRef = ref<HTMLInputElement | null>(null);
const titleRef = ref<HTMLInputElement | null>(null);

const target = computed(() => activeRepo());
const selectedFolder = computed(() =>
  typeof route.query.folder === "string" ? route.query.folder : "",
);

onMounted(async () => {
  if (!target.value) {
    void router.push("/repos");
    return;
  }
  if (!postsState.files.length) await refreshPosts();
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

/** Typing in a field must never trigger a shortcut. */
function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return Boolean(el?.closest("input, textarea, select, [contenteditable='true']"));
}

function onKey(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
  if (e.key === "/") {
    e.preventDefault();
    searchRef.value?.focus();
  } else if (e.key === "n") {
    e.preventDefault();
    startComposing();
  }
}

const drafts = computed(() => new Set(listLocalDrafts().map((d) => d.repoPath)));

const inFolder = computed(() => {
  const contentPath = target.value?.contentPath ?? "";
  return postsState.files
    .map((path) => {
      const rel = path.slice(contentPath.length + 1);
      const parts = rel.split("/");
      const file = parts.pop() ?? rel;
      return { path, name: file, folder: parts.join("/") };
    })
    .filter(
      (e) =>
        !selectedFolder.value ||
        e.folder === selectedFolder.value ||
        e.folder.startsWith(`${selectedFolder.value}/`),
    );
});

const entries = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return inFolder.value.filter((e) => {
    if (onlyUnsaved.value && !drafts.value.has(e.path)) return false;
    return !q || e.name.toLowerCase().includes(q) || e.folder.toLowerCase().includes(q);
  });
});

const unsavedCount = computed(() => inFolder.value.filter((e) => drafts.value.has(e.path)).length);

const folders = computed(() =>
  [...new Set(inFolder.value.map((e) => e.folder))].filter(Boolean).sort(),
);

const location = computed(() =>
  selectedFolder.value
    ? `${target.value?.contentPath}/${selectedFolder.value}`
    : (target.value?.contentPath ?? ""),
);

/** 404 usually means a private repo hidden from an under-scoped token. */
const scopeHint = computed(() => {
  if (postsState.errorStatus !== 404) return "";
  const scopes = auth.scopes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!scopes.length || scopes.includes("repo")) return "";
  return "This repository may be private while your token only carries public_repo. Sign out and back in to grant the repo scope.";
});

function openEntry(path: string): void {
  void router.push({
    path: "/edit",
    query: { path, ...(target.value?.workingBranch ? { branch: target.value.workingBranch } : {}) },
  });
}

function startComposing(): void {
  composing.value = true;
  newPost.folder = selectedFolder.value;
  window.setTimeout(() => titleRef.value?.focus(), 0);
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

async function reload(): Promise<void> {
  await refreshPosts();
}
</script>

<template>
  <div class="view">
    <header class="view-header">
      <div class="view-heading">
        <h1 class="view-title">{{ selectedFolder || "Posts" }}</h1>
        <p class="view-sub mono">{{ location }}</p>
      </div>
      <div class="view-actions">
        <button class="quiet" :disabled="postsState.loading" @click="void reload()">
          {{ postsState.loading ? "Refreshing" : "Refresh" }}
        </button>
        <button class="primary" @click="startComposing">New post</button>
      </div>
    </header>

    <div class="view-body">
      <div class="toolbar">
        <div class="search-wrap">
          <svg class="icon search-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M11.74 10.34a6.5 6.5 0 1 0-1.4 1.4l3.85 3.85a1 1 0 0 0 1.42-1.42l-3.87-3.83zM6.5 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"
            />
          </svg>
          <input
            ref="searchRef"
            v-model="filter"
            class="search"
            type="search"
            placeholder="Search this folder"
            aria-label="Search posts"
          />
          <kbd v-if="!filter" class="hotkey">/</kbd>
        </div>
        <button
          v-if="unsavedCount"
          class="filter-toggle"
          :class="{ on: onlyUnsaved }"
          :aria-pressed="onlyUnsaved"
          @click="onlyUnsaved = !onlyUnsaved"
        >
          <span class="seal" aria-hidden="true" />
          {{ unsavedCount }} unsaved
        </button>
      </div>

      <div v-if="composing" class="block composer">
        <div class="composer-fields">
          <div class="field">
            <label for="new-title">Title</label>
            <input
              id="new-title"
              ref="titleRef"
              v-model="newPost.title"
              type="text"
              placeholder="What are you writing?"
              @keydown.enter="createNew"
              @keydown.esc="composing = false"
            />
          </div>
          <div class="field">
            <label for="new-folder">Folder</label>
            <input
              id="new-folder"
              v-model="newPost.folder"
              type="text"
              placeholder="Optional"
              list="folders"
              @keydown.enter="createNew"
              @keydown.esc="composing = false"
            />
            <datalist id="folders">
              <option v-for="f in folders" :key="f" :value="f" />
            </datalist>
          </div>
        </div>
        <p class="hint">
          The file is created on a draft branch the first time you push, so nothing lands on
          {{ target?.defaultBranch ?? "the default branch" }} until you merge.
        </p>
        <div class="composer-actions">
          <button class="quiet" @click="composing = false">Cancel</button>
          <button class="primary" :disabled="!newPost.title.trim()" @click="createNew">
            Start writing
          </button>
        </div>
      </div>

      <div v-if="postsState.error" class="notice">
        <span>
          {{ postsState.error }}
          <span v-if="scopeHint" class="scope-hint">{{ scopeHint }}</span>
        </span>
      </div>

      <div class="grouped listing">
        <div class="list-head">
          <span class="col-name">Post</span>
          <span class="col-folder">Folder</span>
          <span class="col-state">State</span>
        </div>

        <button v-for="e in entries" :key="e.path" class="row" @click="openEntry(e.path)">
          <span class="col-name row-name">{{ e.name }}</span>
          <span class="col-folder mono muted">{{ e.folder || "Root" }}</span>
          <span class="col-state">
            <span v-if="drafts.has(e.path)" class="state unsaved">
              <span class="seal" aria-hidden="true" />Unsaved edits
            </span>
            <span v-else class="state muted">{{ target?.workingBranch ? "On this branch" : "Published" }}</span>
          </span>
        </button>

        <p v-if="postsState.loading && !entries.length" class="empty muted">
          Reading the repository...
        </p>
        <p v-else-if="!entries.length && (filter || onlyUnsaved)" class="empty muted">
          Nothing matches that filter.
        </p>
        <p v-else-if="!entries.length" class="empty">
          <span class="empty-title">No posts here yet</span>
          <span class="muted">New post creates one in {{ location }}.</span>
        </p>
      </div>

      <p class="hint count-note">
        {{ entries.length }} of {{ inFolder.length }}
        {{ inFolder.length === 1 ? "file" : "files" }} shown
      </p>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.search-wrap {
  position: relative;
  flex: 1;
  max-width: 420px;
}

.search-icon {
  position: absolute;
  top: 50%;
  left: 0.7rem;
  transform: translateY(-50%);
  color: var(--ink-muted);
  pointer-events: none;
}

.search {
  padding-left: 2.1rem;
}

.hotkey {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  transform: translateY(-50%);
  padding: 0.05rem 0.3rem;
  border: 1px solid var(--separator);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--ink-muted);
  pointer-events: none;
}

.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: transparent;
  border-color: var(--separator);
  box-shadow: none;
  color: var(--ink-soft);
  font-weight: 400;
}

.filter-toggle:hover:not(:disabled) {
  box-shadow: none;
}

.filter-toggle.on {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
  font-weight: 500;
}

.composer {
  margin-bottom: 1.25rem;
  max-width: 720px;
}

.composer-fields {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1rem;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.listing .row,
.list-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 14rem) minmax(0, 11rem);
  gap: 1rem;
  align-items: center;
}

.list-head {
  padding: 0.6rem 1.1rem;
  box-shadow: inset 0 -1px 0 var(--separator);
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.row + .row {
  box-shadow: inset 0 1px 0 var(--separator);
}

.state {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
}

.state.unsaved {
  color: var(--accent);
}

.scope-hint {
  display: block;
  margin-top: 0.35rem;
  color: var(--ink-muted);
}

.empty {
  display: grid;
  gap: 0.2rem;
  padding: 2.5rem 1.1rem;
  margin: 0;
  text-align: center;
  font-size: 0.875rem;
}

.empty-title {
  color: var(--ink);
  font-weight: 500;
}

.count-note {
  margin-top: 1rem;
}

@media (max-width: 820px) {
  .listing .row,
  .list-head {
    grid-template-columns: minmax(0, 1fr) minmax(0, 9rem);
  }

  .col-folder {
    display: none;
  }

  .composer-fields {
    grid-template-columns: 1fr;
  }
}
</style>
