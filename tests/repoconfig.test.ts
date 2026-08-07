import { describe, expect, it } from "vitest";
import {
  defaultRepoConfig,
  mergeRepoConfig,
  parseRepoConfig,
  permalinkFor,
} from "../src/lib/repoconfig";

describe("parseRepoConfig", () => {
  it("reads collections, preview and commit template", () => {
    const yaml = [
      "collections:",
      "  - name: posts",
      "    path: content/notes",
      "    extension: .mdx",
      "    fields:",
      "      - name: title",
      "        type: string",
      "        required: true",
      "      - name: mood",
      "        type: enum[]",
      "        options: [happy, sad]",
      "preview:",
      '  urlTemplate: "https://example.com/notes/{slug}/"',
      "commit:",
      '  template: "chore({action}): {path}"',
    ].join("\n");
    const cfg = parseRepoConfig(yaml);
    expect(cfg.contentPath).toBe("content/notes");
    expect(cfg.extension).toBe(".mdx");
    expect(cfg.fields?.map((f) => f.name)).toEqual(["title", "mood"]);
    expect(cfg.urlTemplate).toBe("https://example.com/notes/{slug}/");
    expect(cfg.commitTemplate).toBe("chore({action}): {path}");
  });

  it("returns an empty partial for garbage", () => {
    expect(parseRepoConfig(": : : not yaml")).toEqual({});
  });

  it("skips fields with unknown types", () => {
    const yaml =
      "collections:\n  - path: x\n    fields:\n      - name: ok\n        type: string\n      - name: bad\n        type: wat\n";
    expect(parseRepoConfig(yaml).fields?.map((f) => f.name)).toEqual(["ok"]);
  });
});

describe("mergeRepoConfig / defaults", () => {
  it("overrides only provided keys", () => {
    const merged = mergeRepoConfig({ contentPath: "my/posts" });
    expect(merged.contentPath).toBe("my/posts");
    expect(merged.fields.length).toBe(defaultRepoConfig().fields.length);
    expect(merged.commitTemplate).toBe(defaultRepoConfig().commitTemplate);
  });
});

describe("permalinkFor", () => {
  it("builds a permalink and returns empty without a template", () => {
    expect(permalinkFor("https://example.com/blog/{slug}/", "hello")).toBe(
      "https://example.com/blog/hello/",
    );
    expect(permalinkFor("", "hello")).toBe("");
  });
});
