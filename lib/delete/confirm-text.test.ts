import { describe, expect, it } from "vitest";

import { matchesConfirmText } from "@/lib/delete/confirm-text";

describe("matchesConfirmText", () => {
  it("matches case-insensitively and trimmed", () => {
    expect(matchesConfirmText("  Acme Rentals ", "acme rentals")).toBe(true);
  });
  it("rejects a mismatch", () => {
    expect(matchesConfirmText("acme", "acme rentals")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(matchesConfirmText("", "acme")).toBe(false);
  });
});
