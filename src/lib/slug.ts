export function kebab(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "untitled";
}

/** Branch name for the draft holding edits to a given repo path. */
export function draftBranchFor(repoPath: string): string {
  const file = repoPath.split("/").pop() ?? repoPath;
  const stem = file.replace(/\.mdx?$/i, "");
  return `draft/${kebab(stem)}`;
}
