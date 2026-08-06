import { reactive, watch } from "vue";
import type { GitHubClient } from "@/lib/github";

export interface RepoTarget {
  owner: string;
  repo: string;
  /** Directory inside the repo holding markdown entries. */
  contentPath: string;
  defaultBranch?: string;
}

const REPOS_KEY = "writeshare.repos";
const ACTIVE_KEY = "writeshare.active-repo";

function seed(): RepoTarget[] {
  return [
    {
      owner: "shravanngoswamii",
      repo: "shravanngoswamii.github.io",
      contentPath: "src/content/blog",
    },
  ];
}

function loadList(): RepoTarget[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(REPOS_KEY) ?? "null") as RepoTarget[] | null;
    return parsed?.length ? parsed : seed();
  } catch {
    return seed();
  }
}

export const repos = reactive<{ list: RepoTarget[]; activeIndex: number }>({
  list: loadList(),
  activeIndex: Number(localStorage.getItem(ACTIVE_KEY) ?? 0) || 0,
});

export function activeRepo(): RepoTarget | null {
  return repos.list[repos.activeIndex] ?? repos.list[0] ?? null;
}

export function addRepo(target: RepoTarget): void {
  const existing = repos.list.findIndex(
    (r) =>
      r.owner.toLowerCase() === target.owner.toLowerCase() &&
      r.repo.toLowerCase() === target.repo.toLowerCase(),
  );
  if (existing >= 0) {
    repos.list[existing] = { ...repos.list[existing], ...target };
    setActive(existing);
    return;
  }
  repos.list.push(target);
  setActive(repos.list.length - 1);
}

export function removeRepo(index: number): void {
  repos.list.splice(index, 1);
  if (repos.activeIndex >= repos.list.length)
    repos.activeIndex = Math.max(0, repos.list.length - 1);
}

export function setActive(index: number): void {
  repos.activeIndex = index;
}

watch(
  repos,
  () => {
    localStorage.setItem(REPOS_KEY, JSON.stringify(repos.list));
    localStorage.setItem(ACTIVE_KEY, String(repos.activeIndex));
  },
  { deep: true },
);

/** Repo default branch, fetched once and remembered on the target. */
export async function ensureDefaultBranch(client: GitHubClient): Promise<string> {
  const target = activeRepo();
  if (!target) throw new Error("No repository selected.");
  if (!target.defaultBranch) {
    target.defaultBranch = (await client.repoInfo(target)).default_branch;
  }
  return target.defaultBranch;
}
