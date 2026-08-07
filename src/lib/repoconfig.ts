import * as YAML from "yaml";
import { BLOG_COLLECTION, type CollectionField, type FieldType } from "@/config";
import type { GitHubClient, RepoCoordinate } from "./github";
import { applyTemplate, DEFAULT_COMMIT_TEMPLATE } from "./template";

/**
 * Per-repo configuration. Source of truth: an optional `writeshare.yml` at the
 * repo root, with in-app overrides stored on the RepoTarget.
 */
export interface RepoConfig {
  contentPath: string;
  extension: ".md" | ".mdx";
  fields: CollectionField[];
  template: Record<string, unknown>;
  urlTemplate: string;
  commitTemplate: string;
}

export function defaultRepoConfig(): RepoConfig {
  return {
    contentPath: BLOG_COLLECTION.path,
    extension: BLOG_COLLECTION.extension,
    fields: BLOG_COLLECTION.fields,
    template: { ...BLOG_COLLECTION.template },
    urlTemplate: "",
    commitTemplate: DEFAULT_COMMIT_TEMPLATE,
  };
}

const KNOWN_FIELD_TYPES: ReadonlySet<string> = new Set([
  "string",
  "text",
  "date",
  "boolean",
  "string[]",
  "enum[]",
]);

function sanitizeFields(input: unknown): CollectionField[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const fields: CollectionField[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw as Record<string, unknown>;
    if (typeof f.name !== "string" || typeof f.type !== "string" || !KNOWN_FIELD_TYPES.has(f.type))
      continue;
    fields.push({
      name: f.name,
      label: typeof f.label === "string" ? f.label : f.name,
      type: f.type as FieldType,
      required: f.required === true,
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
      default: f.default,
    });
  }
  return fields.length ? fields : undefined;
}

/** Parse a writeshare.yml document into a partial RepoConfig. Bad input yields an empty partial. */
export function parseRepoConfig(yamlText: string): Partial<RepoConfig> {
  let doc: unknown;
  try {
    doc = YAML.parse(yamlText);
  } catch {
    return {};
  }
  if (!doc || typeof doc !== "object") return {};
  const root = doc as Record<string, unknown>;
  const out: Partial<RepoConfig> = {};

  const collections = Array.isArray(root.collections) ? root.collections : [];
  const first = collections[0] as Record<string, unknown> | undefined;
  if (first) {
    if (typeof first.path === "string" && first.path.trim())
      out.contentPath = first.path.trim().replace(/\/+$/, "");
    if (first.extension === ".md" || first.extension === ".mdx") out.extension = first.extension;
    const fields = sanitizeFields(first.fields);
    if (fields) out.fields = fields;
    if (first.template && typeof first.template === "object") {
      out.template = first.template as Record<string, unknown>;
    }
  }

  const preview = root.preview as Record<string, unknown> | undefined;
  if (preview && typeof preview.urlTemplate === "string") out.urlTemplate = preview.urlTemplate;

  const commit = root.commit as Record<string, unknown> | undefined;
  if (commit && typeof commit.template === "string" && commit.template.trim()) {
    out.commitTemplate = commit.template;
  }

  return out;
}

export function mergeRepoConfig(override: Partial<RepoConfig>): RepoConfig {
  return { ...defaultRepoConfig(), ...override };
}

/** Fetch and apply writeshare.yml from the repo root, if present. */
export async function fetchRepoConfig(
  client: GitHubClient,
  repo: RepoCoordinate,
  defaultBranch: string,
): Promise<RepoConfig> {
  const file = await client.getFile(repo, defaultBranch, "writeshare.yml");
  if (!file) return defaultRepoConfig();
  return mergeRepoConfig(parseRepoConfig(file.content));
}

export function permalinkFor(urlTemplate: string, slug: string): string {
  if (!urlTemplate) return "";
  return applyTemplate(urlTemplate, { slug });
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
