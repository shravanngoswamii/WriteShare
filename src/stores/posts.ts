import { reactive } from "vue";
import { githubClient } from "./auth";
import { activeRepo, ensureDefaultBranch } from "./repos";

interface PostsState {
  files: string[];
  loading: boolean;
  error: string;
}

export const postsState = reactive<PostsState>({
  files: [],
  loading: false,
  error: "",
});

export async function refreshPosts(): Promise<void> {
  const target = activeRepo();
  if (!target) {
    postsState.files = [];
    return;
  }
  postsState.loading = true;
  postsState.error = "";
  try {
    const client = githubClient();
    const branch = await ensureDefaultBranch(client);
    postsState.files = await client.listMarkdownFiles(target, branch, target.contentPath);
  } catch (err) {
    postsState.error = err instanceof Error ? err.message : String(err);
  } finally {
    postsState.loading = false;
  }
}
