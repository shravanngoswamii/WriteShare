// WriteShare configuration.
//
// Modeled (with credit) on Pages CMS's single-config-file idea: one place
// describes the target repository and its content collections. Later this
// can be loaded from a `.pages.yml`/cms config file in the repo itself.

export type FieldType = "string" | "text" | "date" | "boolean" | "string[]" | "enum[]";

export interface CollectionField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[]; // for enum[]
  default?: unknown;
}

export interface CollectionConfig {
  name: string;
  label: string;
  /** Directory inside the repo that holds this collection's entries. */
  path: string;
  extension: ".md" | ".mdx";
  fields: CollectionField[];
  /** Frontmatter keys written by default on a new entry. */
  template: Record<string, unknown>;
}

export const CMS_CONFIG = {
  auth: {
    /**
     * "oauth" gives one-click GitHub sign-in (needs the free proxy in
     * ../oauth-proxy deployed once; see README). "pat" = token entry, zero setup.
     */
    method: "oauth" as "pat" | "oauth",
    oauth: {
      clientId: "Ov23liHJ8nV7rutFvapF", // public; safe to commit
      /** Deployed oauth-proxy worker. */
      exchangeUrl: "https://writeshare-oauth.shravangoswami.workers.dev",
      /**
       * OAuth scope. "repo" covers public and private repos; "public_repo"
       * got 404s from the git refs API even on public repos.
       */
      scope: "repo",
    },
  },
  /** Autosave debounce after the last keystroke, in ms. */
  autosaveMs: 1600,
};

export const BLOG_COLLECTION: CollectionConfig = {
  name: "blog",
  label: "Blog",
  path: "src/content/blog",
  extension: ".md",
  fields: [
    { name: "title", label: "Title", type: "string", required: true },
    { name: "description", label: "Description", type: "text", required: true },
    { name: "pubDatetime", label: "Published", type: "date", required: true },
    { name: "modDatetime", label: "Modified", type: "date" },
    { name: "draft", label: "Draft", type: "boolean", default: true },
    { name: "featured", label: "Featured", type: "boolean", default: false },
    { name: "tags", label: "Tags", type: "string[]" },
    {
      name: "categories",
      label: "Categories",
      type: "enum[]",
      options: ["tech", "cinema", "philosophy"] as const,
      default: ["tech"],
    },
  ],
  template: {
    title: "",
    description: "",
    pubDatetime: "",
    draft: true,
    tags: [],
    categories: ["tech"],
  },
};

export const COLLECTIONS: CollectionConfig[] = [BLOG_COLLECTION];
