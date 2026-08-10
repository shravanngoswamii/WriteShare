<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import type { StatusItem } from "@/components/StatusLine.vue";
import StatusLine from "@/components/StatusLine.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { auth, githubClient } from "@/stores/auth";
import {
  activeRepo,
  addRepo,
  refreshRepoConfig,
  removeRepo,
  repos,
  setActive,
} from "@/stores/repos";
import { settings } from "@/stores/settings";
import { type Palette, setPalette, theme } from "@/stores/theme";

const PALETTES: Array<{ id: Palette; name: string; light: string[]; dark: string[] }> = [
  {
    id: "blueprint",
    name: "blueprint",
    light: ["#e7e8ea", "#101114", "#1b3dff"],
    dark: ["#131418", "#e9eaee", "#6c8cff"],
  },
  {
    id: "riso",
    name: "riso",
    light: ["#e8e4f2", "#161320", "#e0186a"],
    dark: ["#141221", "#eee9ff", "#ff5c96"],
  },
  {
    id: "carbon",
    name: "carbon",
    light: ["#ededed", "#000000", "#5c5c5c"],
    dark: ["#101010", "#f2f2f2", "#9a9a9a"],
  },
];

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

const statusItems = computed<StatusItem[]>(() => [
  { label: "active", value: active.value ? `${active.value.owner}/${active.value.repo}` : "none" },
  { value: `${repos.list.length} in use`, tone: "muted" },
  { value: `${remote.list.length} on github`, tone: "muted" },
]);

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
      <h1 class="large-title">repos</h1>
      <button class="quiet" @click="void router.push('/posts')">Posts</button>
      <ThemeToggle />
    </div>

    <template v-if="repos.list.length">
      <h2 class="section-title">in use</h2>
      <div class="grouped">
        <div v-for="(r, i) in repos.list" :key="`${r.owner}/${r.repo}`" class="strip">
          <button class="row" @click="activate(i)">
            <span class="mark" aria-hidden="true">{{ active === r ? ">" : " " }}</span>
            <span class="row-text">
              <span class="row-name">{{ r.owner }}/{{ r.repo }}</span>
            </span>
            <span class="row-sub">
              {{ r.contentPath }}<template v-if="r.defaultBranch"> on {{ r.defaultBranch }}</template>
            </span>
          </button>
          <button class="row-action" title="Settings, branches and pull requests" @click="manage(i)">Manage</button>
          <button class="row-action destructive" title="Remove from WriteShare" @click="removeRepo(i)">Remove</button>
        </div>
      </div>
      <p class="hint">the marked repo is the one the posts screen reads and writes.</p>
    </template>

    <h2 class="section-title">add a repo</h2>
    <div class="block form-block">
      <div class="field">
        <label for="add-slug">repository</label>
        <input
          id="add-slug"
          v-model="addForm.slug"
          type="text"
          placeholder="owner/repo, or paste a GitHub URL"
          @keydown.enter="add"
        />
      </div>
      <div class="field">
        <label for="add-path">content path</label>
        <input
          id="add-path"
          v-model="addForm.contentPath"
          type="text"
          placeholder="src/content/blog"
          @keydown.enter="add"
        />
      </div>
      <div v-if="addForm.error" class="banner">{{ addForm.error }}</div>
      <div class="block-actions">
        <button class="primary" :disabled="!addForm.slug.trim()" @click="add">Add and write</button>
      </div>
    </div>

    <h2 class="section-title">app settings</h2>
    <div class="block form-block">
      <div class="field">
        <label>palette</label>
        <div class="palette-grid">
          <button
            v-for="p in PALETTES"
            :key="p.id"
            class="palette-card"
            :class="{ active: theme.palette === p.id }"
            @click="setPalette(p.id)"
          >
            <span class="swatches">
              <span v-for="c in [...p.light, ...p.dark]" :key="c" class="swatch" :style="{ background: c }" />
            </span>
            <span class="palette-name">{{ p.name }}</span>
          </button>
        </div>
      </div>
      <label class="checkbox-row">
        <input v-model="settings.autoSaveToGitHub" type="checkbox" />
        <span>push every edit to GitHub automatically</span>
      </label>
      <p class="hint">
        off by default: edits stay in this browser until you press Push in the editor.
      </p>
    </div>

    <h2 class="section-title">your github repos</h2>
    <p v-if="remote.loading" class="muted small">reading your account...</p>
    <div v-else-if="remote.error" class="banner">{{ remote.error }}</div>
    <div v-else class="grouped">
      <button
        v-for="r in remote.list"
        :key="r.full_name"
        class="row"
        :disabled="savedSlugs.has(r.full_name.toLowerCase())"
        @click="quickAdd(r.full_name)"
      >
        <span class="mark" aria-hidden="true">{{ savedSlugs.has(r.full_name.toLowerCase()) ? " " : "+" }}</span>
        <span class="row-text">
          <span class="row-name">{{ r.full_name }}</span>
        </span>
        <span class="row-sub">
          {{ savedSlugs.has(r.full_name.toLowerCase()) ? "already added" : r.private ? "private" : "public" }}
        </span>
      </button>
    </div>

    <StatusLine mode="repos" :items="statusItems" :user="auth.user" />
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  align-items: stretch;
}

.strip + .strip {
  border-top: var(--hair) solid var(--separator);
}

.strip .row {
  flex: 1;
  min-width: 0;
}

.mark {
  width: 1ch;
  color: var(--accent);
  flex-shrink: 0;
  white-space: pre;
}

.row:hover .mark {
  color: var(--canvas);
}

.form-block {
  max-width: 560px;
}

.block-actions {
  display: flex;
  justify-content: flex-end;
}

.palette-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.palette-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-color: var(--separator);
  background: transparent;
  text-transform: none;
  letter-spacing: 0.02em;
  font-weight: 400;
}

.palette-card.active {
  border-color: var(--accent);
  color: var(--ink);
  font-weight: 700;
}

.swatches {
  display: flex;
  flex-shrink: 0;
}

.swatch {
  width: 11px;
  height: 16px;
  border: var(--hair) solid var(--separator);
  border-left: none;
}

.swatch:first-child {
  border-left: var(--hair) solid var(--separator);
}

.palette-name {
  font-size: 0.75rem;
}
</style>
