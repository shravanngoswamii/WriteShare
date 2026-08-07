import { describe, expect, it } from "vitest";
import { parsePost, serializePost } from "../src/lib/frontmatter";

describe("parsePost", () => {
  it("splits frontmatter and body", () => {
    const md = "---\ntitle: Hello\ndraft: true\n---\n\n# Hi\nSome text.\n";
    const { data, body } = parsePost(md);
    expect(data.title).toBe("Hello");
    expect(data.draft).toBe(true);
    expect(body).toBe("# Hi\nSome text.\n");
  });

  it("returns the whole input as body without a fence", () => {
    const { data, body } = parsePost("# Just markdown\n");
    expect(data).toEqual({});
    expect(body).toBe("# Just markdown\n");
  });
});

describe("serializePost", () => {
  it("round-trips with parsePost", () => {
    const md = "---\ntitle: Round trip\ntags:\n  - a\n  - b\n---\n\nBody here.\n";
    const { data, body } = parsePost(md);
    const out = serializePost(data, body);
    const again = parsePost(out);
    expect(again.data).toEqual(data);
    expect(again.body).toContain("Body here.");
  });

  it("drops empty strings but keeps real values", () => {
    const out = serializePost({ title: "T", description: "", draft: false, tags: ["x"] }, "B");
    expect(out).toContain("title: T");
    expect(out).not.toContain("description:");
    expect(out).toContain("draft: false");
    expect(out).toContain("- x");
  });
});
