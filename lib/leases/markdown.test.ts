import { describe, expect, it } from "vitest";
import { parseClauseMarkdown } from "@/lib/leases/markdown";

describe("parseClauseMarkdown", () => {
  it("splits paragraphs on blank lines", () => {
    const out = parseClauseMarkdown("Para one.\n\nPara two.");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ type: "paragraph", runs: [{ text: "Para one." }] });
  });

  it("parses bold and italic inline runs", () => {
    const out = parseClauseMarkdown("Pay **KES 100** now *please*");
    expect(out[0].runs).toEqual([
      { text: "Pay " },
      { text: "KES 100", bold: true },
      { text: " now " },
      { text: "please", italic: true },
    ]);
  });

  it("parses bullet lines", () => {
    const out = parseClauseMarkdown("- first\n- second");
    expect(out).toEqual([
      { type: "bullet", runs: [{ text: "first" }] },
      { type: "bullet", runs: [{ text: "second" }] },
    ]);
  });
});
