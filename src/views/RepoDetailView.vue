<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import type { StatusItem } from "@/components/StatusLine.vue";
import StatusLine from "@/components/StatusLine.vue";
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

const statusItems = computed<StatusItem[]>(() => [
  { label: "repo", value: repo.value ? `${repo.value.owner}/${repo.value.repo}` : "none" },
  { label: "default", value: target.value?.defaultBranch ?? "unknown" },
  { value: `${branches.list.length} draft branches`, tone: "muted" },
  { value: `${prs.list.length} open prs`, tone: "muted" },
  {
    value: target.value?.configSource === "app" ? "config: this browser" : "config: writeshare.yml",
    tone: "muted",
  },
]);

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
      <button class="quiet back-btn" @click="void router.push('/repos')">Repos</button>
      <h1 v-if="target" class="large-title repo-title">{{ target.owner }}/{{ target.repo }}</h1>
      <a :href="repoUrl" target="_blank" rel="noreferrer" class="chip">github.com</a>
      <ThemeToggle />
    </div>

    <div class="tabs" role="tablist">
      <button :class="{ active: tab === 'settings' }" role="tab" @click="tab = 'settings'">Settings</button>
      <button :class="{ active: tab === 'branches' }" role="tab" @click="tab = 'branches'">Branches</button>
      <button :class="{ active: tab === 'prs' }" role="tab" @click="tab = 'prs'">Pull requests</button>
    </div>

    <template v-if="tab === 'settings'">
      <div class="block card">
        <div class="field">
          <label for="content-path">content path</label>
          <input id="content-path" v-model="form.contentPath" type="text" placeholder="src/content/blog" />
        </div>
        <div class="field">
          <label for="url-template">preview url</label>
          <input
            id="url-template"
            v-model="form.urlTemplate"
            type="text"
            placeholder="https://example.com/blog/{slug}/"
          />
          <p class="hint">{slug} is replaced with the file name. leave it empty to skip the permalink.</p>
        </div>
        <div class="field">
          <label for="commit-template">commit message</label>
          <input
            id="commit-template"
            v-model="form.commitTemplate"
            type="text"
            placeholder="{action} {path} (via WriteShare)"
          />
          <p class="hint">tokens: {action}, {path}, {title}.</p>
        </div>
        <div v-if="componentsList.length" class="field">
          <label>components</label>
          <div class="components-list">
            <span v-for="c in componentsList" :key="c.name" class="chip" :title="c.description ?? c.name">
              {{ c.label }}
            </span>
          </div>
          <p class="hint">declared in writeshare.yml, offered by the editor's Insert menu.</p>
        </div>
        <div class="card-actions">
          <button class="primary" @click="saveSettings">{{ form.saved ? "Saved" : "Save settings" }}</button>
          <button class="quiet" :disabled="busy.reloadingConfig" @click="void reloadConfig()">
            {{ busy.reloadingConfig ? "Reloading" : "Reload writeshare.yml" }}
          </button>
        </div>
        <p class="hint">
          <a :href="`${repoUrl}/blob/${target?.defaultBranch ?? 'main'}/writeshare.yml`" target="_blank" rel="noreferrer">
            writeshare.yml
          </a>
          in the repo root is the source of truth. saving here overrides it for this browser only.
        </p>
      </div>
    </template>

    <template v-else-if="tab === 'branches'">
      <p v-if="branches.loading" class="muted small">reading branches...</p>
      <div v-else-if="branches.error" class="banner">{{ branches.error }}</div>
      <div v-else class="grouped">
        <p v-if="!branches.list.length" class="empty muted">
          no draft branches. one appears the first time you push a post.
        </p>
        <div v-for="b in branches.list" :key="b" class="strip">
          <a class="row" :href="`${repoUrl}/tree/${encodeURIComponent(b)}`" target="_blank" rel="noreferrer">
            <span class="row-text">
              <span class="row-name">{{ b }}</span>
            </span>
          </a>
          <button
            class="row-action destructive"
            :disabled="busy.branch === b"
            @click="confirm.branch = b"
          >
            Delete
          </button>
        </div>
      </div>
    </template>

    <template v-else>
      <p v-if="prs.loading" class="muted small">reading pull requests...</p>
      <div v-else-if="prs.error" class="banner">{{ prs.error }}</div>
      <div v-else class="grouped">
        <p v-if="!prs.list.length" class="empty muted">
          no open pull requests. Open PR in the editor starts one.
        </p>
        <div v-for="p in prs.list" :key="p.number" class="pr">
          <div class="strip">
            <a class="row" :href="p.html_url" target="_blank" rel="noreferrer">
              <span class="pr-number">#{{ p.number }}</span>
              <span class="row-text">
                <span class="row-name">{{ p.title }}</span>
              </span>
              <span class="row-sub">{{ p.head.ref }}</span>
            </a>
            <button
              class="row-action"
              @click="mergeUi.openFor = mergeUi.openFor === p.number ? 0 : p.number"
            >
              Merge
            </button>
            <button
              class="row-action destructive"
              :disabled="busy.pr === p.number"
              @click="confirm.closePr = p.number"
            >
              Close
            </button>
          </div>
          <div v-if="mergeUi.openFor === p.number" class="merge-panel">
            <div class="merge-options">
              <label v-for="m in ['squash', 'merge', 'rebase'] as const" :key="m" class="checkbox-row">
                <input v-model="mergeUi.method" type="radio" name="merge-method" :value="m" />
                <span>{{ m === "squash" ? "squash and merge" : m === "merge" ? "merge commit" : "rebase and merge" }}</span>
              </label>
              <label class="checkbox-row">
                <input v-model="mergeUi.deleteBranch" type="checkbox" />
                <span>delete the draft branch afterwards</span>
              </label>
            </div>
            <div class="merge-actions">
              <button class="quiet" :disabled="mergeUi.busy" @click="mergeUi.openFor = 0">Cancel</button>
              <button class="primary" :disabled="mergeUi.busy" @click="void doMerge(p.number)">
                {{ mergeUi.busy ? "Merging" : "Merge" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <StatusLine mode="repo" :items="statusItems" />

    <ConfirmDialog
      :open="confirm.branch !== ''"
      title="delete branch"
      :body="`Delete draft branch '${confirm.branch}'? Commits on it stay on GitHub, but the branch ref is removed.`"
      confirm-label="Delete"
      danger
      :busy="busy.branch !== ''"
      @confirm="void removeBranch(confirm.branch)"
      @cancel="confirm.branch = ''"
    />
    <ConfirmDialog
      :open="confirm.closePr !== 0"
      title="close pull request"
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

.back-btn::before {
  content: "<- ";
}

.repo-title::before {
  content: none;
}

.tabs {
  display: flex;
  border: var(--edge) solid var(--ink);
  border-bottom: none;
  max-width: 820px;
}

.tabs button {
  border: none;
  border-right: var(--hair) solid var(--separator);
  background: transparent;
  color: var(--ink-muted);
  padding: 0.5rem 0.9rem;
}

.tabs button:last-of-type {
  border-right: none;
}

.tabs button.active {
  background: var(--ink);
  color: var(--canvas);
}

.card {
  max-width: 820px;
  border-top: none;
}

.components-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.grouped {
  max-width: 820px;
  border-top: none;
}

.strip {
  display: flex;
  align-items: stretch;
}

.strip + .strip,
.pr + .pr {
  border-top: var(--hair) solid var(--separator);
}

.strip .row {
  flex: 1;
  min-width: 0;
}

.pr-number {
  color: var(--ink-muted);
  flex-shrink: 0;
}

.row:hover .pr-number {
  color: var(--canvas);
}

.empty {
  padding: 0.9rem 0.7rem;
  margin: 0;
}

.merge-panel {
  border-top: var(--hair) solid var(--separator);
  padding: 0.7rem;
  display: grid;
  gap: 0.7rem;
  background: var(--fill);
}

.merge-options {
  display: grid;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.merge-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
