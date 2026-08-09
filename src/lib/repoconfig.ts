import * as YAML from "yaml";
import { BLOG_COLLECTION, type CollectionField, type FieldType } from "@/config";
import type { GitHubClient, RepoCoordinate } from "./github";
import { applyTemplate, DEFAULT_COMMIT_TEMPLATE } from "./template";

/** A component snippet a repo declares, inserted as source text at the cursor. */
export interface ComponentSnippet {
  name: string;
  label: string;
  insert: string;
  description?: string;
}

/**
 * Per-repo configuration. Source of truth: an optional `writeshare.yml` at the
 * repo root, with in-app overrides stored on the RepoTarget.
 */
export interface RepoConfig {
  contentPath: string;
  /** File extension for new entries and listing priority (e.g. .md, .mdx, .qmd). */
  extension: string;
  fields: CollectionField[];
  template: Record<string, unknown>;
  urlTemplate: string;
  commitTemplate: string;
  components: ComponentSnippet[];
}

export function defaultRepoConfig(): RepoConfig {
  return {
    contentPath: BLOG_COLLECTION.path,
    extension: BLOG_COLLECTION.extension,
    fields: BLOG_COLLECTION.fields,
    template: { ...BLOG_COLLECTION.template },
    urlTemplate: "",
    commitTemplate: DEFAULT_COMMIT_TEMPLATE,
    components: [],
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
    if (typeof first.extension === "string" && /^\.[a-z0-9]{1,8}$/i.test(first.extension)) {
      out.extension = first.extension.toLowerCase();
    }
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

  const components = sanitizeComponents(root.components);
  if (components) out.components = components;

  return out;
}

function sanitizeComponents(input: unknown): ComponentSnippet[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: ComponentSnippet[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.name !== "string" || typeof c.insert !== "string" || !c.insert.trim()) continue;
    out.push({
      name: c.name,
      label: typeof c.label === "string" ? c.label : c.name,
      insert: c.insert,
      description: typeof c.description === "string" ? c.description : undefined,
    });
  }
  return out.length ? out : undefined;
}

export function mergeRepoConfig(override: Partial<RepoConfig>): RepoConfig {
  const out: Record<string, unknown> = { ...defaultRepoConfig() };
  // Keys present with value undefined (older cached targets) must not erase defaults.
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) out[key] = value;
  }
  return out as unknown as RepoConfig;
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
