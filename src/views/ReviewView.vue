<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import { githubClient } from "@/stores/auth";
import {
  forgetBranch,
  forgetPr,
  type OpenPr,
  pipeline,
  prForBranch,
  refreshPipeline,
  rememberPr,
} from "@/stores/pipeline";
import { refreshPosts } from "@/stores/posts";
import { activeRepo, ensureDefaultBranch } from "@/stores/repos";
import { notify } from "@/stores/toasts";

interface Item {
  branch: string;
  pr: OpenPr | undefined;
  title: string;
}

const router = useRouter();
const target = computed(() => activeRepo());

const busy = reactive({ branch: "", pr: 0, opening: "" });
const confirm = reactive({ branch: "", closePr: 0 });
const mergeUi = reactive({
  openFor: 0,
  method: "squash" as "squash" | "merge" | "rebase",
  deleteBranch: true,
  busy: false,
});

const repoUrl = computed(() =>
  target.value ? `https://github.com/${target.value.owner}/${target.value.repo}` : "#",
);

/** One row per draft branch, with its pull request when there is one. */
const items = computed<Item[]>(() => {
  const branches = new Set([...pipeline.branches, ...pipeline.prs.map((p) => p.head.ref)]);
  return [...branches]
    .sort((a, b) => a.localeCompare(b))
    .map((branch) => {
      const pr = prForBranch(branch);
      return { branch, pr, title: pr?.title ?? branch.replace(/^draft\//, "") };
    });
});

const awaitingPr = computed(() => items.value.filter((i) => !i.pr).length);

onMounted(() => {
  void refreshPipeline(true);
});

function openInEditor(branch: string): void {
  const t = target.value;
  if (!t) return;
  t.workingBranch = branch;
  void refreshPosts();
  void router.push("/posts");
}

async function openPr(branch: string): Promise<void> {
  const t = target.value;
  if (!t) return;
  busy.opening = branch;
  try {
    const client = githubClient();
    const base = await ensureDefaultBranch(client);
    const title = `post: ${branch.replace(/^draft\//, "")}`;
    const body = [
      "Draft post created with WriteShare.",
      "",
      `- Branch: \`${branch}\``,
      "",
      "Review and merge when ready.",
    ].join("\n");
    const url =
      (await client.findOpenPrUrl(t, branch)) ??
      (await client.createPr(t, base, branch, title, body));
    const number = Number(url.split("/").pop());
    rememberPr({
      number,
      title,
      head: { ref: branch },
      html_url: url,
      updated_at: new Date().toISOString(),
    });
    notify("Pull request opened.", "ok", {
      label: "View on GitHub",
      run: () => window.open(url, "_blank", "noopener"),
    });
  } catch (err) {
    notify(err instanceof Error ? err.message : String(err), "error");
  } finally {
    busy.opening = "";
  }
}

async function doMerge(pr: OpenPr): Promise<void> {
  const t = target.value;
  if (!t) return;
  mergeUi.busy = true;
  try {
    const client = githubClient();
    await client.mergePr(t, pr.number, mergeUi.method);
    if (mergeUi.deleteBranch && pr.head.ref.startsWith("draft/")) {
      await client.deleteBranch(t, pr.head.ref).catch(() => {});
      forgetBranch(pr.head.ref);
    } else {
      forgetPr(pr.number);
    }
    if (t.workingBranch === pr.head.ref) t.workingBranch = undefined;
    mergeUi.openFor = 0;
    notify(`Merged pull request #${pr.number}. The post is published.`, "ok");
    await Promise.all([refreshPipeline(true), refreshPosts()]);
  } catch (err) {
    notify(err instanceof Error ? err.message : String(err), "error");
  } finally {
    mergeUi.busy = false;
  }
}

async function doClosePr(prNumber: number): Promise<void> {
  const t = target.value;
  if (!t) return;
  busy.pr = prNumber;
  try {
    await githubClient().closePr(t, prNumber);
    forgetPr(prNumber);
    notify(`Closed pull request #${prNumber}. The branch is untouched.`);
  } catch (err) {
    notify(err instanceof Error ? err.message : String(err), "error");
  } finally {
    busy.pr = 0;
    confirm.closePr = 0;
  }
}

async function removeBranch(branch: string): Promise<void> {
  const t = target.value;
  if (!t) return;
  busy.branch = branch;
  try {
    await githubClient().deleteBranch(t, branch);
    forgetBranch(branch);
    if (t.workingBranch === branch) t.workingBranch = undefined;
    notify(`Deleted ${branch}.`);
  } catch (err) {
    notify(err instanceof Error ? err.message : String(err), "error");
  } finally {
    busy.branch = "";
    confirm.branch = "";
  }
}
</script>

<template>
  <div class="view">
    <header class="view-header">
      <div class="view-heading">
        <h1 class="view-title">Review</h1>
        <p class="view-sub">Draft branches and the pull requests that publish them.</p>
      </div>
      <div class="view-actions">
        <button class="quiet" :disabled="pipeline.loading" @click="void refreshPipeline(true)">
          {{ pipeline.loading ? "Refreshing" : "Refresh" }}
        </button>
      </div>
    </header>

    <div class="view-body">
      <div v-if="pipeline.error" class="notice"><span>{{ pipeline.error }}</span></div>

      <p v-if="items.length" class="hint stage-note">
        {{ items.length }} {{ items.length === 1 ? "post is" : "posts are" }} in flight.
        <template v-if="awaitingPr">
          {{ awaitingPr }} {{ awaitingPr === 1 ? "needs" : "need" }} a pull request before anyone can review
          {{ awaitingPr === 1 ? "it" : "them" }}.
        </template>
        <template v-else>Every one of them is waiting on a merge.</template>
      </p>

      <div class="grouped">
        <div v-for="item in items" :key="item.branch" class="pipeline-item">
          <div class="item-row">
            <span class="stage" :class="item.pr ? 'in-review' : 'pushed'">
              <span class="seal" :class="item.pr ? 'ok' : ''" aria-hidden="true" />
              {{ item.pr ? "In review" : "Pushed" }}
            </span>

            <span class="item-text">
              <span class="item-title">{{ item.title }}</span>
              <a class="item-branch mono" :href="`${repoUrl}/tree/${encodeURIComponent(item.branch)}`" target="_blank" rel="noreferrer">
                {{ item.branch }}
              </a>
            </span>

            <span class="item-actions">
              <button
                class="quiet"
                title="Switch to this branch and list its posts"
                @click="openInEditor(item.branch)"
              >
                Browse branch
              </button>

              <template v-if="item.pr">
                <a class="pr-link" :href="item.pr.html_url" target="_blank" rel="noreferrer">
                  #{{ item.pr.number }} on GitHub
                </a>
                <button
                  class="primary"
                  @click="mergeUi.openFor = mergeUi.openFor === item.pr.number ? 0 : item.pr.number"
                >
                  Merge
                </button>
                <button
                  class="destructive"
                  :disabled="busy.pr === item.pr.number"
                  @click="confirm.closePr = item.pr.number"
                >
                  Close
                </button>
              </template>

              <template v-else>
                <button
                  class="primary"
                  :disabled="busy.opening === item.branch"
                  @click="void openPr(item.branch)"
                >
                  {{ busy.opening === item.branch ? "Opening" : "Open pull request" }}
                </button>
                <button
                  class="destructive"
                  :disabled="busy.branch === item.branch"
                  @click="confirm.branch = item.branch"
                >
                  Discard branch
                </button>
              </template>
            </span>
          </div>

          <div v-if="item.pr && mergeUi.openFor === item.pr.number" class="merge-panel">
            <div class="merge-options">
              <label v-for="m in ['squash', 'merge', 'rebase'] as const" :key="m" class="checkbox-row">
                <input v-model="mergeUi.method" type="radio" name="merge-method" :value="m" />
                <span>{{ m === "squash" ? "Squash and merge" : m === "merge" ? "Merge commit" : "Rebase and merge" }}</span>
              </label>
              <label class="checkbox-row">
                <input v-model="mergeUi.deleteBranch" type="checkbox" />
                <span>Delete the draft branch afterwards</span>
              </label>
            </div>
            <div class="merge-actions">
              <button class="quiet" :disabled="mergeUi.busy" @click="mergeUi.openFor = 0">Cancel</button>
              <button class="primary" :disabled="mergeUi.busy" @click="void doMerge(item.pr)">
                {{ mergeUi.busy ? "Merging" : "Merge and publish" }}
              </button>
            </div>
          </div>
        </div>

        <p v-if="pipeline.loading && !items.length" class="empty muted">Checking GitHub...</p>
        <p v-else-if="!items.length" class="empty">
          <span class="empty-title">Nothing waiting</span>
          <span class="muted">
            Push a post from the editor and it shows up here, ready for a pull request.
          </span>
        </p>
      </div>
    </div>

    <ConfirmDialog
      :open="confirm.branch !== ''"
      title="Discard this draft branch?"
      :body="`Deleting '${confirm.branch}' removes the branch ref on GitHub. Commits stay in the repository's history, but the draft leaves your pipeline.`"
      confirm-label="Discard branch"
      danger
      :busy="busy.branch !== ''"
      @confirm="void removeBranch(confirm.branch)"
      @cancel="confirm.branch = ''"
    />
    <ConfirmDialog
      :open="confirm.closePr !== 0"
      title="Close without merging?"
      :body="`Pull request #${confirm.closePr} closes and the post stays unpublished. The draft branch and its commits are kept.`"
      confirm-label="Close pull request"
      danger
      :busy="busy.pr !== 0"
      @confirm="void doClosePr(confirm.closePr)"
      @cancel="confirm.closePr = 0"
    />
  </div>
</template>

<style scoped>
.stage-note {
  margin: 0 0 1rem;
}

.pipeline-item + .pipeline-item {
  box-shadow: inset 0 1px 0 var(--separator);
}

.item-row {
  display: grid;
  grid-template-columns: 8.5rem minmax(0, 1fr) max-content;
  gap: 1.25rem;
  align-items: center;
  padding: 0.9rem 1.1rem;
}

.stage {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8125rem;
  color: var(--ink-muted);
}

.stage.in-review {
  color: var(--ok);
}

.stage.pushed {
  color: var(--accent);
}

.item-text {
  min-width: 0;
  display: grid;
  gap: 0.1rem;
}

.item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-branch {
  font-size: 0.78rem;
  color: var(--ink-muted);
  justify-self: start;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.pr-link {
  font-size: 0.8125rem;
  color: var(--ink-muted);
  margin-right: 0.15rem;
}

.merge-panel {
  box-shadow: inset 0 1px 0 var(--separator);
  padding: 1rem 1.1rem;
  display: grid;
  gap: 1rem;
  background: var(--fill);
}

.merge-options {
  display: grid;
  gap: 0.6rem;
  font-size: 0.875rem;
}

.merge-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
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

@media (max-width: 900px) {
  .item-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }

  .item-actions {
    justify-content: flex-start;
  }
}
</style>
