import { describe, expect, it } from "vitest";
import { applyTemplate, DEFAULT_COMMIT_TEMPLATE } from "../src/lib/template";

describe("applyTemplate", () => {
  it("substitutes known tokens", () => {
    expect(applyTemplate("{action} {path}", { action: "Update", path: "a/b.md" })).toBe(
      "Update a/b.md",
    );
  });

  it("leaves unknown tokens intact", () => {
    expect(applyTemplate("{action} {unknown}", { action: "Create" })).toBe("Create {unknown}");
  });

  it("default commit template renders fully", () => {
    expect(
      applyTemplate(DEFAULT_COMMIT_TEMPLATE, {
        action: "Create",
        path: "content/posts/x.md",
        title: "X",
      }),
    ).toBe("Create content/posts/x.md (via WriteShare)");
  });
});
