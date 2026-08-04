import { describe, expect, it } from "vitest";

import {
  resolveDepositVerification,
  type DepositVerifyFacts,
} from "@/lib/billing/deposit-verification";

function facts(over: Partial<DepositVerifyFacts> = {}): DepositVerifyFacts {
  return {
    paymentSucceeded: true,
    tenantId: "t1",
    kind: "water",
    grossKes: 5000,
    tenantProfileId: "user-1",
    authUserId: "user-1",
    alreadyProcessed: false,
    ...over,
  };
}

describe("resolveDepositVerification", () => {
  it("errors 400 when the payment did not succeed", () => {
    expect(resolveDepositVerification(facts({ paymentSucceeded: false }))).toEqual({
      kind: "error", status: 400, message: expect.stringMatching(/not successful/i),
    });
  });

  it("errors 400 when tenantId is missing", () => {
    expect(resolveDepositVerification(facts({ tenantId: null })).kind).toBe("error");
  });

  it("errors 400 on an invalid kind", () => {
    const d = resolveDepositVerification(facts({ kind: "internet" }));
    expect(d).toMatchObject({ kind: "error", status: 400 });
  });

  it("errors 400 on a non-positive amount", () => {
    expect(resolveDepositVerification(facts({ grossKes: 0 })).kind).toBe("error");
    expect(resolveDepositVerification(facts({ grossKes: Number.NaN })).kind).toBe("error");
  });

  it("errors 403 when the tenant is not owned by the caller", () => {
    expect(resolveDepositVerification(facts({ tenantProfileId: "someone-else" }))).toEqual({
      kind: "error", status: 403, message: expect.stringMatching(/your own/i),
    });
    expect(resolveDepositVerification(facts({ tenantProfileId: null }))).toMatchObject({ kind: "error", status: 403 });
  });

  it("returns already when the reference was processed", () => {
    expect(resolveDepositVerification(facts({ alreadyProcessed: true }))).toEqual({
      kind: "already",
    });
  });

  it("returns record with the resolved fields on the happy path", () => {
    expect(resolveDepositVerification(facts({ kind: "rent", grossKes: 20000 }))).toEqual({
      kind: "record", tenantId: "t1", depositKind: "rent", grossKes: 20000,
    });
  });

  it("checks ownership before idempotency (security precedence)", () => {
    // Not owned AND already processed → still forbidden.
    expect(
      resolveDepositVerification(
        facts({ tenantProfileId: "x", alreadyProcessed: true }),
      ).kind,
    ).toBe("error");
  });
});
