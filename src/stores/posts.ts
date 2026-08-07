import { reactive } from "vue";
import { GitHubError } from "@/lib/github";
import { githubClient } from "./auth";
import { activeRepo, ensureDefaultBranch } from "./repos";

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
    const branch = await ensureDefaultBranch(client);
    postsState.files = await client.listMarkdownFiles(target, branch, target.contentPath);
  } catch (err) {
    postsState.error = err instanceof Error ? err.message : String(err);
    postsState.errorStatus = err instanceof GitHubError ? err.status : null;
  } finally {
    postsState.loading = false;
  }
}
