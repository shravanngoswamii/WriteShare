import { describe, expect, it } from "vitest";
import { draftBranchFor, kebab } from "../src/lib/slug";

describe("kebab", () => {
  it("slugifies titles", () => {
    expect(kebab("Hello, World! And Beyond")).toBe("hello-world-and-beyond");
  });

  it("strips quotes and edge dashes", () => {
    expect(kebab("  --It's a test--  ")).toBe("its-a-test");
  });

  it("falls back for empty input", () => {
    expect(kebab("")).toBe("untitled");
  });
});

describe("draftBranchFor", () => {
  it("derives the branch from the file stem", () => {
    expect(draftBranchFor("src/content/blog/2026/my-post.md")).toBe("draft/my-post");
  });

  it("handles mdx and odd names", () => {
    expect(draftBranchFor("posts/My Great Post.mdx")).toBe("draft/my-great-post");
  });
});
