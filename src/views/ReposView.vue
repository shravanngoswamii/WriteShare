<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { githubClient } from "@/stores/auth";
import {
  activeRepo,
  addRepo,
  refreshRepoConfig,
  removeRepo,
  repos,
  setActive,
} from "@/stores/repos";

const router = useRouter();
const addForm = reactive({ slug: "", contentPath: "src/content/blog", error: "" });
const remote = reactive<{
  list: Array<{ full_name: string; private: boolean }>;
  loading: boolean;
  error: string;
}>({
  list: [],
  loading: false,
  error: "",
});

const active = computed(() => activeRepo());

onMounted(async () => {
  remote.loading = true;
  try {
    remote.list = await githubClient().listUserRepos();
  } catch (err) {
    remote.error = err instanceof Error ? err.message : String(err);
  } finally {
    remote.loading = false;
  }
});

const savedSlugs = computed(
  () => new Set(repos.list.map((r) => `${r.owner}/${r.repo}`.toLowerCase())),
);

function parseSlug(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  return parts.length === 2 && parts[0] && parts[1] ? { owner: parts[0], repo: parts[1] } : null;
}

function add(): void {
  addForm.error = "";
  const slug = parseSlug(addForm.slug);
  if (!slug) {
    addForm.error = "Enter a repository as owner/repo.";
    return;
  }
  addRepo({ ...slug, contentPath: addForm.contentPath.trim() || "src/content/blog" });
  addForm.slug = "";
  const t = active.value;
  if (t) void refreshRepoConfig(githubClient(), t).catch(() => {});
  void router.push("/posts");
}

function quickAdd(fullName: string): void {
  const slug = parseSlug(fullName);
  if (slug) addRepo({ ...slug, contentPath: "src/content/blog" });
  const t = active.value;
  if (t) void refreshRepoConfig(githubClient(), t).catch(() => {});
  void router.push("/posts");
}

function activate(index: number): void {
  setActive(index);
  const t = repos.list[index];
  if (t && !t.configCheckedAt) void refreshRepoConfig(githubClient(), t).catch(() => {});
  void router.push("/posts");
}

function manage(index: number): void {
  setActive(index);
  void router.push("/repo");
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <h1 class="large-title">Repositories</h1>
      <ThemeToggle />
    </div>

    <div v-if="repos.list.length" class="grouped">
      <div v-for="(r, i) in repos.list" :key="`${r.owner}/${r.repo}`" class="repo-row">
        <button class="row" @click="activate(i)">
          <span class="row-text">
            <span class="row-name">{{ r.owner }}/{{ r.repo }}</span>
            <span class="row-sub">
              {{ r.contentPath }}<template v-if="r.defaultBranch"> · {{ r.defaultBranch }}</template>
            </span>
          </span>
          <span v-if="active === r" class="active-dot" aria-label="active" />
        </button>
        <button class="manage-btn" title="Settings, branches and pull requests" @click="manage(i)">Manage</button>
        <button class="remove-btn" title="Remove" @click="removeRepo(i)">
          <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"
            />
          </svg>
        </button>
      </div>
    </div>

    <h2 class="section-title">Add a repository</h2>
    <div class="composer">
      <input
        v-model="addForm.slug"
        type="text"
        placeholder="owner/repo or a GitHub URL"
        aria-label="repository"
        @keydown.enter="add"
      />
      <input
        v-model="addForm.contentPath"
        type="text"
        placeholder="content path, e.g. src/content/blog"
        aria-label="content path"
        @keydown.enter="add"
      />
      <div v-if="addForm.error" class="banner">{{ addForm.error }}</div>
      <div class="composer-actions">
        <button class="primary" :disabled="!addForm.slug.trim()" @click="add">Add and write</button>
      </div>
    </div>

    <h2 class="section-title">Your repositories</h2>
    <p v-if="remote.loading" class="muted small">Loading...</p>
    <div v-else-if="remote.error" class="banner">{{ remote.error }}</div>
    <div v-else class="grouped">
      <div v-for="r in remote.list" :key="r.full_name" class="repo-row">
        <button class="row" :disabled="savedSlugs.has(r.full_name.toLowerCase())" @click="quickAdd(r.full_name)">
          <span class="row-text">
            <span class="row-name">{{ r.full_name }}</span>
            <span class="row-sub">{{ r.private ? "private" : "public" }}</span>
          </span>
          <span v-if="savedSlugs.has(r.full_name.toLowerCase())" class="muted small">added</span>
          <svg v-else class="icon chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 1.5a.75.75 0 0 1 .75.75v5h5a.75.75 0 0 1 0 1.5h-5v5a.75.75 0 0 1-1.5 0v-5h-5a.75.75 0 0 1 0-1.5h5v-5A.75.75 0 0 1 8 1.5z"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 2rem 0 0.75rem;
}

.grouped {
  background: var(--paper);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.repo-row {
  display: flex;
  align-items: stretch;
}

.repo-row + .repo-row {
  border-top: 1px solid var(--separator);
}

.row {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  background: transparent;
  border-radius: 0;
  padding: 0.85rem 1.15rem;
}

.row:hover:not(:disabled) {
  background: var(--fill);
}

.row:active:not(:disabled) {
  transform: none;
}

.row:disabled {
  opacity: 1;
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

.active-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ok);
  flex-shrink: 0;
}

.chevron {
  color: var(--ink-muted);
}

.remove-btn,
.manage-btn {
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  padding: 0 1rem;
}

.remove-btn:hover:not(:disabled) {
  background: transparent;
  color: var(--danger);
}

.manage-btn:hover:not(:disabled) {
  background: var(--fill-strong);
  color: var(--ink);
}

.composer {
  background: var(--paper);
  border-radius: var(--radius-lg);
  padding: 1rem;
  display: grid;
  gap: 0.6rem;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
