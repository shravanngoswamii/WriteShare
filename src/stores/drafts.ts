export interface LocalDraft {
  body: string;
  fm: Record<string, unknown>;
  updatedAt: number;
}

const PREFIX = "writeshare.draft.";

export function draftKey(owner: string, repo: string, repoPath: string): string {
  return `${PREFIX}${owner}/${repo}/${repoPath}`;
}

export function saveLocalDraft(key: string, draft: LocalDraft): void {
  localStorage.setItem(key, JSON.stringify(draft));
}

export function loadLocalDraft(key: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft;
    return typeof parsed.body === "string" && parsed.fm && typeof parsed.updatedAt === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function deleteLocalDraft(key: string): void {
  localStorage.removeItem(key);
}

export interface LocalDraftEntry {
  key: string;
  owner: string;
  repo: string;
  repoPath: string;
  updatedAt: number;
}

/** Every local draft, for "unsaved" badges on lists. */
export function listLocalDrafts(): LocalDraftEntry[] {
  const out: LocalDraftEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const rest = key.slice(PREFIX.length);
    const slash = rest.indexOf("/");
    const second = rest.indexOf("/", slash + 1);
    if (slash < 0 || second < 0) continue;
    const draft = loadLocalDraft(key);
    if (!draft) continue;
    out.push({
      key,
      owner: rest.slice(0, slash),
      repo: rest.slice(slash + 1, second),
      repoPath: rest.slice(second + 1),
      updatedAt: draft.updatedAt,
    });
  }
  return out;
}
