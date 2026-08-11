<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import { githubClient } from "@/stores/auth";
import { refreshPipeline } from "@/stores/pipeline";
import { refreshPosts } from "@/stores/posts";
import {
  activeRepo,
  addRepo,
  refreshRepoConfig,
  removeRepo,
  repos,
  setActive,
} from "@/stores/repos";
import { notify } from "@/stores/toasts";

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
const savedSlugs = computed(
  () => new Set(repos.list.map((r) => `${r.owner}/${r.repo}`.toLowerCase())),
);

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

function parseSlug(input: string): { owner: string; repo: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  return parts.length === 2 && parts[0] && parts[1] ? { owner: parts[0], repo: parts[1] } : null;
}

/** Adding, quick-adding and switching all end the same way: on the posts list. */
async function enter(index: number): Promise<void> {
  setActive(index);
  const repo = repos.list[index];
  if (repo && !repo.configCheckedAt) {
    await refreshRepoConfig(githubClient(), repo).catch(() => {});
  }
  await Promise.all([refreshPosts(), refreshPipeline(true)]);
  void router.push("/posts");
}

async function add(): Promise<void> {
  addForm.error = "";
  const slug = parseSlug(addForm.slug);
  if (!slug) {
    addForm.error = "Enter a repository as owner/repo, or paste its GitHub URL.";
    return;
  }
  addRepo({ ...slug, contentPath: addForm.contentPath.trim() || "src/content/blog" });
  addForm.slug = "";
  notify(`Added ${slug.owner}/${slug.repo}.`, "ok");
  await enter(repos.activeIndex);
}

async function quickAdd(fullName: string): Promise<void> {
  const slug = parseSlug(fullName);
  if (!slug) return;
  addRepo({ ...slug, contentPath: "src/content/blog" });
  notify(`Added ${fullName}.`, "ok");
  await enter(repos.activeIndex);
}

function drop(index: number): void {
  const r = repos.list[index];
  removeRepo(index);
  if (r) notify(`Removed ${r.owner}/${r.repo} from WriteShare. The repository is untouched.`);
}
</script>

<template>
  <div class="view">
    <header class="view-header">
      <div class="view-heading">
        <h1 class="view-title">Repositories</h1>
        <p class="view-sub">Pick the repository you are writing into.</p>
      </div>
    </header>

    <div class="view-body repos-body">
      <section v-if="repos.list.length">
        <h2 class="section-title flush">In WriteShare</h2>
        <div class="grouped">
          <div v-for="(r, i) in repos.list" :key="`${r.owner}/${r.repo}`" class="strip">
            <button class="row" @click="void enter(i)">
              <span v-if="active === r" class="seal" title="Currently open" aria-label="currently open" />
              <span v-else class="seal-gap" aria-hidden="true" />
              <span class="row-text">
                <span class="row-name">{{ r.owner }}/{{ r.repo }}</span>
              </span>
              <span class="row-sub mono">
                {{ r.contentPath }}<template v-if="r.defaultBranch"> · {{ r.defaultBranch }}</template>
              </span>
            </button>
            <button class="row-action destructive" title="Remove from WriteShare" @click="drop(i)">
              Remove
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 class="section-title">Add by name</h2>
        <div class="block form-block">
          <div class="add-fields">
            <div class="field">
              <label for="add-slug">Repository</label>
              <input
                id="add-slug"
                v-model="addForm.slug"
                type="text"
                placeholder="owner/repo, or paste a GitHub URL"
                @keydown.enter="void add()"
              />
            </div>
            <div class="field">
              <label for="add-path">Content path</label>
              <input
                id="add-path"
                v-model="addForm.contentPath"
                type="text"
                placeholder="src/content/blog"
                @keydown.enter="void add()"
              />
            </div>
          </div>
          <div v-if="addForm.error" class="notice"><span>{{ addForm.error }}</span></div>
          <div class="block-actions">
            <button class="primary" :disabled="!addForm.slug.trim()" @click="void add()">
              Add and start writing
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 class="section-title">On your GitHub account</h2>
        <p v-if="remote.loading" class="muted small">Reading your account...</p>
        <div v-else-if="remote.error" class="notice"><span>{{ remote.error }}</span></div>
        <div v-else class="grouped">
          <button
            v-for="r in remote.list"
            :key="r.full_name"
            class="row"
            :disabled="savedSlugs.has(r.full_name.toLowerCase())"
            @click="void quickAdd(r.full_name)"
          >
            <span class="row-text">
              <span class="row-name">{{ r.full_name }}</span>
            </span>
            <span class="row-sub">
              {{ savedSlugs.has(r.full_name.toLowerCase()) ? "Added" : r.private ? "Private" : "Public" }}
            </span>
          </button>
          <p v-if="!remote.list.length" class="empty muted">No repositories on this account.</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.repos-body {
  display: grid;
  gap: 1rem;
  max-width: 860px;
}

.section-title.flush {
  margin-top: 0;
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
  max-width: 640px;
}

.add-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 1rem;
}

.block-actions {
  display: flex;
  justify-content: flex-end;
}

.empty {
  padding: 1.5rem 1.1rem;
  margin: 0;
  text-align: center;
  font-size: 0.875rem;
}

@media (max-width: 700px) {
  .add-fields {
    grid-template-columns: 1fr;
  }
}
</style>
