import { reactive } from "vue";
import { GitHubError } from "@/lib/github";
import { githubClient } from "./auth";
import { activeRepo, ensureDefaultBranch, resolveConfig } from "./repos";

interface PostsState {
  files: string[];
  loading: boolean;
  error: string;
  errorStatus: number | null;
}

export const postsState = reactive<PostsState>({
  files: [],
  loading: false,
  error: "",
  errorStatus: null,
});

/** Files are listed on this branch when the user picked one (empty = default branch). */
export async function refreshPosts(): Promise<void> {
  const target = activeRepo();
  if (!target) {
    postsState.files = [];
    return;
  }
  postsState.loading = true;
  postsState.error = "";
  postsState.errorStatus = null;
  try {
    const client = githubClient();
    const branch = target.workingBranch || (await ensureDefaultBranch(client));
    const cfg = resolveConfig(target);
    const extensions = [...new Set([".md", ".mdx", cfg.extension])];
    postsState.files = await client.listMarkdownFiles(
      target,
      branch,
      target.contentPath,
      extensions,
    );
  } catch (err) {
    postsState.error = err instanceof Error ? err.message : String(err);
    postsState.errorStatus = err instanceof GitHubError ? err.status : null;
  } finally {
    postsState.loading = false;
  }
}
