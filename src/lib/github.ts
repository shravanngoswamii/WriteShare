import { decodeBase64, encodeBase64 } from "./base64";

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface RepoCoordinate {
  owner: string;
  repo: string;
}

export interface FilePayload {
  content: string;
  sha: string;
}

interface TreeItem {
  path: string;
  type: "blob" | "tree" | string;
  sha: string;
}

/**
 * Minimal REST client covering exactly what a writing desk needs:
 * read/write files on branches, create branches, open pull requests.
 */
export class GitHubClient {
  constructor(private readonly token: string) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    if (res.status === 401) {
      // Token expired or revoked -> let the app bounce back to sign-in.
      window.dispatchEvent(new CustomEvent("writeshare:unauthorized"));
    }
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof data === "object" && data !== null && "message" in data
          ? String((data as { message: unknown }).message)
          : res.statusText;
      throw new GitHubError(res.status, message);
    }
    return data as T;
  }

  user(): Promise<GitHubUser> {
    return this.req<GitHubUser>("GET", "/user");
  }

  private async branchHeadSha(repo: RepoCoordinate, branch: string): Promise<string> {
    const ref = await this.req<{ object: { sha: string } }>(
      "GET",
      `/repos/${repo.owner}/${repo.repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    return ref.object.sha;
  }

  /** All markdown file paths under `dir` on the given branch (one API call). */
  async listMarkdownFiles(repo: RepoCoordinate, branch: string, dir: string): Promise<string[]> {
    const sha = await this.branchHeadSha(repo, branch);
    const tree = await this.req<{ tree: TreeItem[]; truncated: boolean }>(
      "GET",
      `/repos/${repo.owner}/${repo.repo}/git/trees/${sha}?recursive=1`,
    );
    const prefix = `${dir.replace(/\/+$/, "")}/`;
    return tree.tree
      .filter((t) => t.type === "blob" && t.path.startsWith(prefix) && /\.mdx?$/i.test(t.path))
      .map((t) => t.path)
      .sort();
  }

  /** Contents API GET. Resolves to null when the file does not exist. */
  async getFile(repo: RepoCoordinate, branch: string, path: string): Promise<FilePayload | null> {
    try {
      const res = await this.req<{
        content: string;
        sha: string;
        encoding: string;
      }>(
        "GET",
        `/repos/${repo.owner}/${repo.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
      );
      return { content: decodeBase64(res.content), sha: res.sha };
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null;
      throw err;
    }
  }

  /** Create or update `path` on `branch`. Returns the new blob sha. */
  async putFile(
    repo: RepoCoordinate,
    branch: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<string> {
    const res = await this.req<{ content: { sha: string } }>(
      "PUT",
      `/repos/${repo.owner}/${repo.repo}/contents/${encodePath(path)}`,
      {
        message,
        content: encodeBase64(content),
        branch,
        ...(sha ? { sha } : {}),
      },
    );
    return res.content.sha;
  }

  /** Create `refs/heads/<branch>` from the repo's base branch head. No-op if it exists. */
  async createBranch(repo: RepoCoordinate, fromBranch: string, newBranch: string): Promise<void> {
    const sha = await this.branchHeadSha(repo, fromBranch);
    try {
      await this.req("POST", `/repos/${repo.owner}/${repo.repo}/git/refs`, {
        ref: `refs/heads/${newBranch}`,
        sha,
      });
    } catch (err) {
      if (err instanceof GitHubError && err.status === 422) return; // branch already exists
      throw err;
    }
  }

  /** Repo HTML URL of the open PR for `branch`, if any. */
  async findOpenPrUrl(repo: RepoCoordinate, branch: string): Promise<string | null> {
    const prs = await this.req<Array<{ html_url: string }>>(
      "GET",
      `/repos/${repo.owner}/${repo.repo}/pulls?state=open&head=${encodeURIComponent(`${repo.owner}:${branch}`)}`,
    );
    return prs[0]?.html_url ?? null;
  }

  async createPr(
    repo: RepoCoordinate,
    baseBranch: string,
    branch: string,
    title: string,
    body: string,
  ): Promise<string> {
    const pr = await this.req<{ html_url: string }>(
      "POST",
      `/repos/${repo.owner}/${repo.repo}/pulls`,
      {
        title,
        head: branch,
        base: baseBranch,
        body,
      },
    );
    return pr.html_url;
  }
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
