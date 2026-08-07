import { reactive, watch } from "vue";
import type { CollectionField } from "@/config";
import type { GitHubClient } from "@/lib/github";
import {
  defaultRepoConfig,
  fetchRepoConfig,
  mergeRepoConfig,
  type RepoConfig,
} from "@/lib/repoconfig";

export interface RepoTarget {
  owner: string;
  repo: string;
  /** Directory inside the repo holding markdown entries. */
  contentPath: string;
  defaultBranch?: string;
  /** App overrides and writeshare.yml cache (undefined = inherit defaults). */
  extension?: ".md" | ".mdx";
  fields?: CollectionField[];
  fmTemplate?: Record<string, unknown>;
  urlTemplate?: string;
  commitTemplate?: string;
  /** Last time writeshare.yml was fetched; manual edits mark the target as app-configured. */
  configCheckedAt?: number;
  configSource?: "file" | "app";
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

/** Effective config for a target: defaults, then writeshare.yml cache/overrides. */
export function resolveConfig(target: RepoTarget): RepoConfig {
  const base = defaultRepoConfig();
  return mergeRepoConfig({
    contentPath: target.contentPath || base.contentPath,
    extension: target.extension,
    fields: target.fields,
    template: target.fmTemplate,
    urlTemplate: target.urlTemplate || undefined,
    commitTemplate: target.commitTemplate,
  });
}

/** Fetch writeshare.yml from the repo and cache it on the target. */
export async function refreshRepoConfig(client: GitHubClient, target: RepoTarget): Promise<void> {
  const branch = target.defaultBranch ?? (await ensureDefaultBranch(client));
  const cfg = await fetchRepoConfig(client, target, branch);
  target.contentPath = cfg.contentPath;
  target.extension = cfg.extension;
  target.fields = cfg.fields;
  target.fmTemplate = cfg.template;
  target.urlTemplate = cfg.urlTemplate;
  target.commitTemplate = cfg.commitTemplate;
  target.configCheckedAt = Date.now();
  target.configSource = "file";
}
