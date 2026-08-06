import { reactive } from "vue";
import { CMS_CONFIG } from "@/config";
import { githubClient } from "./auth";

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

export async function refreshPosts(collectionPath: string): Promise<void> {
  postsState.loading = true;
  postsState.error = "";
  try {
    const { owner, repo, baseBranch } = CMS_CONFIG.repo;
    postsState.files = await githubClient().listMarkdownFiles(
      { owner, repo },
      baseBranch,
      collectionPath,
    );
  } catch (err) {
    postsState.error = err instanceof Error ? err.message : String(err);
  } finally {
    postsState.loading = false;
  }
}
