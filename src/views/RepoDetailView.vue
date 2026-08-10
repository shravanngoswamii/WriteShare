<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { githubClient } from "@/stores/auth";
import { activeRepo, refreshRepoConfig, resolveConfig } from "@/stores/repos";

type Pr = {
  number: number;
  title: string;
  head: { ref: string };
  html_url: string;
  updated_at: string;
};

const router = useRouter();
const target = computed(() => activeRepo());
const tab = ref<"settings" | "branches" | "prs">("settings");

const form = reactive({ contentPath: "", urlTemplate: "", commitTemplate: "", saved: false });
const branches = reactive<{ list: string[]; loading: boolean; error: string }>({
  list: [],
  loading: false,
  error: "",
});
const prs = reactive<{ list: Pr[]; loading: boolean; error: string }>({
  list: [],
  loading: false,
  error: "",
});
const busy = reactive({ branch: "", pr: 0, reloadingConfig: false });
const confirm = reactive({ branch: "", closePr: 0 });
const mergeUi = reactive({
  openFor: 0,
  method: "squash" as "squash" | "merge" | "rebase",
  deleteBranch: true,
  busy: false,
});

const repo = computed(() => {
  const r = target.value;
  return r ? { owner: r.owner, repo: r.repo } : null;
});
const componentsList = computed(() => (target.value ? resolveConfig(target.value).components : []));
const repoUrl = computed(() =>
  repo.value ? `https://github.com/${repo.value.owner}/${repo.value.repo}` : "#",
);

onMounted(async () => {
  if (!target.value) {
    void router.push("/repos");
    return;
  }
  const cfg = resolveConfig(target.value);
  form.contentPath = cfg.contentPath;
  form.urlTemplate = cfg.urlTemplate;
  form.commitTemplate = cfg.commitTemplate;
  await Promise.all([loadBranches(), loadPrs()]);
});

async function loadBranches(): Promise<void> {
  const r = repo.value;
  if (!r) return;
  branches.loading = true;
  branches.error = "";
  try {
    branches.list = await githubClient().listBranches(r, "draft/");
  } catch (err) {
    branches.error = err instanceof Error ? err.message : String(err);
  } finally {
    branches.loading = false;
  }
}

async function loadPrs(): Promise<void> {
  const r = repo.value;
  if (!r) return;
  prs.loading = true;
  prs.error = "";
  try {
    prs.list = await githubClient().listOpenPrs(r);
  } catch (err) {
    prs.error = err instanceof Error ? err.message : String(err);
  } finally {
    prs.loading = false;
  }
}

function saveSettings(): void {
  const t = target.value;
  if (!t) return;
  t.contentPath = form.contentPath.trim().replace(/^\/+|\/+$/g, "") || t.contentPath;
  t.urlTemplate = form.urlTemplate.trim();
  t.commitTemplate = form.commitTemplate.trim() || undefined;
  t.configSource = "app";
  form.saved = true;
  window.setTimeout(() => (form.saved = false), 1600);
}

async function reloadConfig(): Promise<void> {
  const t = target.value;
  if (!t) return;
  busy.reloadingConfig = true;
  try {
    await refreshRepoConfig(githubClient(), t);
    const cfg = resolveConfig(t);
    form.contentPath = cfg.contentPath;
    form.urlTemplate = cfg.urlTemplate;
    form.commitTemplate = cfg.commitTemplate;
  } finally {
    busy.reloadingConfig = false;
  }
}

async function removeBranch(branch: string): Promise<void> {
  const r = repo.value;
  if (!r) return;
  busy.branch = branch;
  try {
    await githubClient().deleteBranch(r, branch);
    branches.list = branches.list.filter((b) => b !== branch);
  } finally {
    busy.branch = "";
    confirm.branch = "";
  }
}

async function doMerge(prNumber: number): Promise<void> {
  const r = repo.value;
  if (!r) return;
  mergeUi.busy = true;
  try {
    const client = githubClient();
    const headRef = prs.list.find((p) => p.number === prNumber)?.head.ref;
    await client.mergePr(r, prNumber, mergeUi.method);
    if (mergeUi.deleteBranch && headRef?.startsWith("draft/")) {
      await client.deleteBranch(r, headRef).catch(() => {});
    }
    prs.list = prs.list.filter((p) => p.number !== prNumber);
    mergeUi.openFor = 0;
    await Promise.all([loadBranches(), loadPrs()]);
  } finally {
    mergeUi.busy = false;
  }
}

async function doClosePr(prNumber: number): Promise<void> {
  const r = repo.value;
  if (!r) return;
  busy.pr = prNumber;
  try {
    await githubClient().closePr(r, prNumber);
    prs.list = prs.list.filter((p) => p.number !== prNumber);
  } finally {
    busy.pr = 0;
    confirm.closePr = 0;
  }
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <button class="back-btn" @click="void router.push('/repos')">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M10.354 3.146a.5.5 0 0 1 0 .708L6.207 8l4.147 4.146a.5.5 0 0 1-.708.708l-4.5-4.5a.5.5 0 0 1 0-.708l4.5-4.5a.5.5 0 0 1 .708 0z"
          />
        </svg>
        Repositories
      </button>
      <h1 class="large-title repo-title" v-if="target">{{ target.owner }}/{{ target.repo }}</h1>
      <a :href="repoUrl" target="_blank" rel="noreferrer" class="chip">github.com</a>
      <ThemeToggle />
    </div>

    <div class="tabs" role="tablist">
      <button :class="{ active: tab === 'settings' }" role="tab" @click="tab = 'settings'">Settings</button>
      <button :class="{ active: tab === 'branches' }" role="tab" @click="tab = 'branches'">Branches</button>
      <button :class="{ active: tab === 'prs' }" role="tab" @click="tab = 'prs'">Pull requests</button>
    </div>

    <template v-if="tab === 'settings'">
      <div class="card">
        <div class="field">
          <label for="content-path">Content path</label>
          <input id="content-path" v-model="form.contentPath" type="text" placeholder="src/content/blog" />
        </div>
        <div class="field">
          <label for="url-template">Preview URL template ({slug} token, optional)</label>
          <input id="url-template" v-model="form.urlTemplate" type="text" placeholder="https://example.com/blog/{slug}/" />
        </div>
        <div class="field">
          <label for="commit-template">Commit message template ({action}, {path}, {title})</label>
          <input id="commit-template" v-model="form.commitTemplate" type="text" placeholder="{action} {path} (via WriteShare)" />
        </div>
        <div v-if="componentsList.length" class="field">
          <label>Components (from writeshare.yml, available in the editor's Insert menu)</label>
          <div class="components-list">
            <span v-for="c in componentsList" :key="c.name" class="chip" :title="c.description ?? c.name">
              {{ c.label }}
            </span>
          </div>
        </div>
        <div class="settings-actions">
          <button class="primary" @click="saveSettings">{{ form.saved ? "Saved" : "Save settings" }}</button>
          <button :disabled="busy.reloadingConfig" @click="void reloadConfig()">
            {{ busy.reloadingConfig ? "Reloading..." : "Reload writeshare.yml" }}
          </button>
        </div>
        <p class="muted small">
          A
          <a :href="`${repoUrl}/blob/${target?.defaultBranch ?? 'main'}/writeshare.yml`" target="_blank" rel="noreferrer">
            writeshare.yml
          </a>
          in the repo root is the source of truth; saving here overrides it for this browser.
        </p>
      </div>
    </template>

    <template v-else-if="tab === 'branches'">
      <p v-if="branches.loading" class="muted">Loading...</p>
      <div v-else-if="branches.error" class="banner">{{ branches.error }}</div>
      <div v-else class="grouped">
        <p v-if="!branches.list.length" class="muted empty">No draft branches.</p>
        <div v-for="b in branches.list" :key="b" class="repo-row">
          <a class="row row-link" :href="`${repoUrl}/tree/${encodeURIComponent(b)}`" target="_blank" rel="noreferrer">
            <span class="row-text">
              <span class="row-name">{{ b }}</span>
            </span>
          </a>
          <button class="remove-btn" :disabled="busy.branch === b" @click="confirm.branch = b">Delete</button>
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="prs.loading" class="muted">Loading...</p>
      <div v-else-if="prs.error" class="banner">{{ prs.error }}</div>
      <div v-else class="grouped">
        <p v-if="!prs.list.length" class="muted empty">No open pull requests.</p>
        <div v-for="p in prs.list" :key="p.number" class="pr">
          <div class="repo-row pr-row">
            <a class="row row-link" :href="p.html_url" target="_blank" rel="noreferrer">
              <span class="row-text">
                <span class="row-name">#{{ p.number }} {{ p.title }}</span>
                <span class="row-sub">{{ p.head.ref }}</span>
              </span>
            </a>
            <button class="merge-btn" @click="mergeUi.openFor = mergeUi.openFor === p.number ? 0 : p.number">
              Merge...
            </button>
            <button class="remove-btn" :disabled="busy.pr === p.number" @click="confirm.closePr = p.number">Close</button>
          </div>
          <div v-if="mergeUi.openFor === p.number" class="merge-panel">
            <div class="merge-options">
              <label class="checkbox-row" v-for="m in ['squash', 'merge', 'rebase'] as const" :key="m">
                <input v-model="mergeUi.method" type="radio" name="merge-method" :value="m" />
                <span>{{ m === 'squash' ? 'Squash and merge' : m === 'merge' ? 'Merge commit' : 'Rebase and merge' }}</span>
              </label>
              <label class="checkbox-row">
                <input v-model="mergeUi.deleteBranch" type="checkbox" />
                <span>Delete the draft branch after merging</span>
              </label>
            </div>
            <div class="merge-actions">
              <button class="quiet" :disabled="mergeUi.busy" @click="mergeUi.openFor = 0">Cancel</button>
              <button class="primary" :disabled="mergeUi.busy" @click="void doMerge(p.number)">
                {{ mergeUi.busy ? "Merging..." : "Merge" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <ConfirmDialog
      :open="confirm.branch !== ''"
      title="Delete branch"
      :body="`Delete draft branch '${confirm.branch}'? Commits on it stay on GitHub, but the branch ref is removed.`"
      confirm-label="Delete"
      danger
      :busy="busy.branch !== ''"
      @confirm="void removeBranch(confirm.branch)"
      @cancel="confirm.branch = ''"
    />
    <ConfirmDialog
      :open="confirm.closePr !== 0"
      title="Close pull request"
      :body="`Close PR #${confirm.closePr} without merging?`"
      confirm-label="Close PR"
      danger
      :busy="busy.pr !== 0"
      @confirm="void doClosePr(confirm.closePr)"
      @cancel="confirm.closePr = 0"
    />
  </div>
</template>

<style scoped>
.back-btn {
  flex-shrink: 0;
}

.repo-title {
  font-size: 1.15rem;
}

.tabs {
  display: flex;
  gap: 1.5rem;
  border-bottom: 1.5px solid var(--ink);
  margin-bottom: 1.25rem;
}

.tabs button {
  border: none;
  border-radius: 0;
  background: transparent;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--ink-muted);
  padding: 0.6rem 0.1rem;
  margin-bottom: -1.5px;
  border-bottom: 2px solid transparent;
}

.tabs button:hover:not(:disabled) {
  background: transparent;
  color: var(--ink);
}

.tabs button.active {
  color: var(--ink);
  border-bottom-color: var(--accent);
}

.card {
  background: transparent;
  border: 1.5px solid var(--ink);
  border-radius: var(--radius-sm);
  padding: 1.25rem;
  max-width: 640px;
}

.components-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.settings-actions {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0 1rem;
}

.grouped {
  background: transparent;
  border-top: 1.5px solid var(--ink);
  border-bottom: 1.5px solid var(--ink);
  max-width: 820px;
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
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0.85rem 1.15rem;
  text-align: left;
}

.row-link {
  color: var(--ink);
}

.row:hover:not(:disabled) {
  background: var(--fill);
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
}

.row-sub {
  font-size: 0.8rem;
  color: var(--ink-muted);
}

.remove-btn,
.merge-btn {
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 0 1rem;
  align-self: center;
}

.merge-btn {
  border: 1.5px solid var(--ink);
  border-radius: var(--radius-sm);
  border-left: none;
  border-right: none;
  margin: 0.6rem 0;
  padding: 0.35rem 0.9rem;
  align-self: center;
}

.merge-btn:hover:not(:disabled) {
  background: var(--fill-strong);
}

.remove-btn {
  color: var(--danger);
}

.remove-btn:hover:not(:disabled) {
  background: transparent;
}

.empty {
  padding: 1rem 1.15rem;
  margin: 0;
}

.pr .merge-panel {
  border-top: 1.5px solid var(--ink);
  padding: 1rem 1.15rem;
  display: grid;
  gap: 0.75rem;
  background: transparent;
}

.merge-options {
  display: grid;
  gap: 0.45rem;
}

.merge-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
