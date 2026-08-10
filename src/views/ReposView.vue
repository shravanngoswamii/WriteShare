<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
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
    id: "washi",
    name: "Washi",
    light: ["#ecebe6", "#faf9f7", "#3f5d7d"],
    dark: ["#1b1b19", "#292927", "#94aec9"],
  },
  {
    id: "hinoki",
    name: "Hinoki",
    light: ["#eae7df", "#f9f7f2", "#5c7355"],
    dark: ["#1c1a15", "#2a2821", "#a3bd97"],
  },
  {
    id: "ash",
    name: "Ash",
    light: ["#eaebec", "#f8f9fa", "#47606f"],
    dark: ["#191b1c", "#26292b", "#9db6c4"],
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
      <span class="bar-gap" />
      <button class="quiet" @click="void router.push('/posts')">Posts</button>
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
    </div>

    <template v-if="repos.list.length">
      <h2 class="section-title">In use</h2>
      <div class="grouped">
        <div v-for="(r, i) in repos.list" :key="`${r.owner}/${r.repo}`" class="strip">
          <button class="row" @click="activate(i)">
            <span v-if="active === r" class="seal" title="Active repository" aria-label="active" />
            <span v-else class="seal-gap" aria-hidden="true" />
            <span class="row-text">
              <span class="row-name">{{ r.owner }}/{{ r.repo }}</span>
            </span>
            <span class="row-sub mono">
              {{ r.contentPath }}<template v-if="r.defaultBranch"> · {{ r.defaultBranch }}</template>
            </span>
          </button>
          <button class="row-action" title="Settings, branches and pull requests" @click="manage(i)">Manage</button>
          <button class="row-action destructive" title="Remove from WriteShare" @click="removeRepo(i)">Remove</button>
        </div>
      </div>
      <p class="hint">The marked repository is the one the posts screen reads and writes.</p>
    </template>

    <h2 class="section-title">Add a repository</h2>
    <div class="block form-block">
      <div class="field">
        <label for="add-slug">Repository</label>
        <input
          id="add-slug"
          v-model="addForm.slug"
          type="text"
          placeholder="owner/repo, or paste a GitHub URL"
          @keydown.enter="add"
        />
      </div>
      <div class="field">
        <label for="add-path">Content path</label>
        <input
          id="add-path"
          v-model="addForm.contentPath"
          type="text"
          placeholder="src/content/blog"
          @keydown.enter="add"
        />
      </div>
      <div v-if="addForm.error" class="notice"><span>{{ addForm.error }}</span></div>
      <div class="block-actions">
        <button class="primary" :disabled="!addForm.slug.trim()" @click="add">Add and write</button>
      </div>
    </div>

    <h2 class="section-title">Preferences</h2>
    <div class="block form-block">
      <div class="field">
        <label>Palette</label>
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
        <span>Push every edit to GitHub automatically</span>
      </label>
      <p class="hint">
        Off by default: edits stay in this browser until you press Push in the editor.
      </p>
    </div>

    <h2 class="section-title">On your GitHub account</h2>
    <p v-if="remote.loading" class="muted small">Reading your account...</p>
    <div v-else-if="remote.error" class="notice"><span>{{ remote.error }}</span></div>
    <div v-else class="grouped">
      <button
        v-for="r in remote.list"
        :key="r.full_name"
        class="row"
        :disabled="savedSlugs.has(r.full_name.toLowerCase())"
        @click="quickAdd(r.full_name)"
      >
        <span class="row-text">
          <span class="row-name">{{ r.full_name }}</span>
        </span>
        <span class="row-sub">
          {{ savedSlugs.has(r.full_name.toLowerCase()) ? "Added" : r.private ? "Private" : "Public" }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.avatar {
  border-radius: 50%;
  display: block;
  flex-shrink: 0;
}

.strip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-right: 0.6rem;
}

.strip + .strip {
  box-shadow: inset 0 1px 0 var(--separator);
}

.strip .row {
  flex: 1;
  min-width: 0;
}

.seal-gap {
  width: 6px;
  flex-shrink: 0;
}

.form-block {
  max-width: 520px;
}

.block-actions {
  display: flex;
  justify-content: flex-end;
}

.palette-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.palette-card {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.75rem 0.45rem 0.5rem;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  font-weight: 400;
  color: var(--ink-soft);
}

.palette-card:hover:not(:disabled) {
  box-shadow: none;
}

.palette-card.active {
  border-color: var(--accent);
  color: var(--ink);
  font-weight: 500;
}

.swatches {
  display: flex;
  flex-shrink: 0;
}

.swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--separator);
}

.swatch + .swatch {
  margin-left: -5px;
}

.palette-name {
  font-size: 0.875rem;
}
</style>
