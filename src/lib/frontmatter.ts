import * as YAML from "yaml";

export interface ParsedPost {
  /** Frontmatter keys as authored. */
  data: Record<string, unknown>;
  /** Markdown body after the frontmatter fence. */
  body: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parsePost(markdown: string): ParsedPost {
  const m = FM_RE.exec(markdown);
  if (!m) return { data: {}, body: markdown };
  let data: Record<string, unknown> = {};
  try {
    const parsed = YAML.parse(m[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // Broken frontmatter should not destroy the body; hand both back.
  }
  return { data, body: markdown.slice(m[0].length).replace(/^\r?\n/, "") };
}

export function serializePost(data: Record<string, unknown>, body: string): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    clean[k] = v;
  }
  const yamlText = YAML.stringify(clean).trimEnd();
  return `---\n${yamlText}\n---\n\n${body.trimEnd()}\n`;
}
