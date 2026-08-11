import { reactive } from "vue";
import { githubClient } from "./auth";
import { activeRepo } from "./repos";

export interface OpenPr {
  number: number;
  title: string;
  head: { ref: string };
  html_url: string;
  updated_at: string;
}

/**
 * Everything in flight between a draft and a published post: the draft branches
 * and the pull requests opened from them. Shared so the sidebar badge, the
 * review screen and the editor all agree without refetching.
 */
export const pipeline = reactive<{
  branches: string[];
  prs: OpenPr[];
  loading: boolean;
  error: string;
  loadedFor: string;
}>({
  branches: [],
  prs: [],
  loading: false,
  error: "",
  loadedFor: "",
});

function slug(): string {
  const t = activeRepo();
  return t ? `${t.owner}/${t.repo}` : "";
}

export function prForBranch(branch: string): OpenPr | undefined {
  return pipeline.prs.find((p) => p.head.ref === branch);
}

/** Count of things waiting on the writer: unpublished branches and open PRs. */
export function pendingCount(): number {
  const withPr = new Set(pipeline.prs.map((p) => p.head.ref));
  return pipeline.prs.length + pipeline.branches.filter((b) => !withPr.has(b)).length;
}

export async function refreshPipeline(force = false): Promise<void> {
  const target = activeRepo();
  if (!target) return;
  const key = slug();
  if (!force && pipeline.loadedFor === key) return;
  pipeline.loading = true;
  pipeline.error = "";
  try {
    const client = githubClient();
    const [branches, prs] = await Promise.all([
      client.listBranches(target, "draft/"),
      client.listOpenPrs(target),
    ]);
    pipeline.branches = branches;
    pipeline.prs = prs;
    pipeline.loadedFor = key;
  } catch (err) {
    pipeline.error = err instanceof Error ? err.message : String(err);
  } finally {
    pipeline.loading = false;
  }
}

export function rememberPr(pr: OpenPr): void {
  if (!prForBranch(pr.head.ref)) pipeline.prs.push(pr);
  if (!pipeline.branches.includes(pr.head.ref)) pipeline.branches.push(pr.head.ref);
}

export function forgetBranch(branch: string): void {
  pipeline.branches = pipeline.branches.filter((b) => b !== branch);
  pipeline.prs = pipeline.prs.filter((p) => p.head.ref !== branch);
}

export function forgetPr(number: number): void {
  pipeline.prs = pipeline.prs.filter((p) => p.number !== number);
}
