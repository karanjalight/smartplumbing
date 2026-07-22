# Dynamic Payment Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the client payments screen show only the payment tabs a tenant actually has set up (water, electricity, both, or rent-only), instead of always showing all three.

**Architecture:** A new pure helper, `getAvailablePaymentTypes()`, derives the list of available tabs from the existing `ClientTenantProfile.meterNo` / `electricityMeterNo` fields (non-blank = assigned, rent always included). `ClientPaymentsView` consumes this list to filter its segmented control and to pick the initially-selected tab, with no other behavior changes.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Vitest, Tailwind.

## Global Constraints

- Availability is derived only from `profile.meterNo` / `profile.electricityMeterNo` being non-blank after `.trim()` — no new DB column, no new `ClientTenantProfile` field, no separate "tenant category" concept.
- Rent is always included in the available tabs, regardless of meter assignment.
- `DEMO_CLIENT_TENANT_PROFILE` is not special-cased — it follows the same derivation as any real tenant.
- The initially-selected tab is the first entry of the derived list (order: water, electricity, rent).
- No changes to `app/clients/payments/page.tsx`, the Paystack integration, or the `/api/paystack/verify-vend` / `/api/paystack/verify-rent` routes.

---

### Task 1: Add `getAvailablePaymentTypes` helper to `lib/client-tenant-profile.ts`

**Files:**
- Modify: `lib/client-tenant-profile.ts` (append after `loadClientTenantProfileForPage`, currently ending at line 185)
- Create: `lib/client-tenant-profile.test.ts`

**Interfaces:**
- Produces: `export type PaymentType = "water" | "electricity" | "rent"` and `export function getAvailablePaymentTypes(profile: Pick<ClientTenantProfile, "meterNo" | "electricityMeterNo">): PaymentType[]` — Task 2 imports both from `@/lib/client-tenant-profile`.

- [ ] **Step 1: Write the failing test**

Create `lib/client-tenant-profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { getAvailablePaymentTypes } from "@/lib/client-tenant-profile";

describe("getAvailablePaymentTypes", () => {
  it("includes water and rent when only a water meter is assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "12345", electricityMeterNo: "" })
    ).toEqual(["water", "rent"]);
  });

  it("includes electricity and rent when only an electricity meter is assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "", electricityMeterNo: "98765" })
    ).toEqual(["electricity", "rent"]);
  });

  it("includes all three when both meters are assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "12345", electricityMeterNo: "98765" })
    ).toEqual(["water", "electricity", "rent"]);
  });

  it("includes only rent when neither meter is assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "", electricityMeterNo: "" })
    ).toEqual(["rent"]);
  });

  it("treats whitespace-only meter numbers as not assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "   ", electricityMeterNo: "  " })
    ).toEqual(["rent"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/client-tenant-profile.test.ts`
Expected: FAIL — `getAvailablePaymentTypes` is not exported from `@/lib/client-tenant-profile` (import error / undefined).

- [ ] **Step 3: Implement the helper**

Append to the end of `lib/client-tenant-profile.ts` (after the existing `loadClientTenantProfileForPage` function):

```ts
export type PaymentType = "water" | "electricity" | "rent";

export function getAvailablePaymentTypes(
  profile: Pick<ClientTenantProfile, "meterNo" | "electricityMeterNo">
): PaymentType[] {
  const types: PaymentType[] = [];
  if (profile.meterNo.trim()) types.push("water");
  if (profile.electricityMeterNo.trim()) types.push("electricity");
  types.push("rent");
  return types;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/client-tenant-profile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/client-tenant-profile.ts lib/client-tenant-profile.test.ts
git commit -m "feat: derive available client payment types from assigned meters"
```

---

### Task 2: Make `ClientPaymentsView`'s tabs data-driven

**Files:**
- Modify: `components/client/client-payments-view.tsx:1-19` (imports), `:102-121` (component body/state), `:479-552` (segmented control JSX)

**Interfaces:**
- Consumes: `getAvailablePaymentTypes(profile: Pick<ClientTenantProfile, "meterNo" | "electricityMeterNo">): PaymentType[]` and `type PaymentType` from `@/lib/client-tenant-profile` (Task 1).

- [ ] **Step 1: Update the import block**

In `components/client/client-payments-view.tsx`, replace:

```tsx
import type { ClientTenantProfile } from "@/lib/client-tenant-profile";
```

with:

```tsx
import {
  getAvailablePaymentTypes,
  type ClientTenantProfile,
  type PaymentType,
} from "@/lib/client-tenant-profile";
```

- [ ] **Step 2: Add the tab config constant**

Directly below the existing module-level constants (after `const LITRES_PER_TOKEN = 1000;`, currently line 23), add:

```tsx
const PAYMENT_TAB_CONFIG: Array<{ type: PaymentType; icon: typeof Droplets; label: string }> = [
  { type: "water", icon: Droplets, label: "Buy Tokens" },
  { type: "electricity", icon: Zap, label: "Buy Electricity" },
  { type: "rent", icon: Building2, label: "Pay Rent" },
];
```

- [ ] **Step 3: Derive `availableTypes` and change the default tab state**

Replace:

```tsx
  const [paymentType, setPaymentType] = useState<"water" | "electricity" | "rent">("water");
```

with:

```tsx
  const availableTypes = getAvailablePaymentTypes(profile);
  const [paymentType, setPaymentType] = useState<PaymentType>(() => availableTypes[0]);
```

(This line sits just above `const [amountInput, setAmountInput] = useState<string>("1000");` — leave the rest of that state block unchanged.)

- [ ] **Step 4: Replace the hardcoded segmented control with a data-driven one**

Replace the whole tab-switcher block (the `<div className="mt-5 flex gap-2 rounded-2xl bg-white/10 p-1.5">...</div>` containing the three `<label>` blocks for water/electricity/rent) with:

```tsx
          <div className="mt-5 flex gap-2 rounded-2xl bg-white/10 p-1.5">
            {PAYMENT_TAB_CONFIG.filter((tab) => availableTypes.includes(tab.type)).map((tab) => {
              const Icon = tab.icon;
              return (
                <label key={tab.type} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="payment-type"
                    className="sr-only"
                    checked={paymentType === tab.type}
                    onChange={() => {
                      setPaymentType(tab.type);
                      setPurchaseResult(null);
                      setRentResult(null);
                      if (tab.type === "rent") {
                        setRentAmountInput(
                          String(profile.balanceKes > 0 ? profile.balanceKes : profile.rentKes)
                        );
                      }
                    }}
                  />
                  <span
                    className={
                      paymentType === tab.type
                        ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                        : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                    }
                  >
                    <Icon className="size-4" aria-hidden />
                    {tab.label}
                  </span>
                </label>
              );
            })}
          </div>
```

This preserves the exact prior markup/classes/behavior per tab (including the rent-tab's amount-reset side effect), just driven by `availableTypes` instead of three hardcoded blocks.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 5 new ones from Task 1.

- [ ] **Step 8: Manual verification**

Start the dev server (`npm run dev`) and check `/clients/payments` for each combination by temporarily editing `DEMO_CLIENT_TENANT_PROFILE` in `lib/client-tenant-profile.ts` (it's returned whenever `fetchCurrentClientTenantProfile` finds no session, which is the default when running locally without logging in):

  - `meterNo: "12345", electricityMeterNo: ""` → only "Buy Tokens" and "Pay Rent" show, "Buy Tokens" selected by default.
  - `meterNo: "", electricityMeterNo: "98765"` → only "Buy Electricity" and "Pay Rent" show, "Buy Electricity" selected by default.
  - `meterNo: "12345", electricityMeterNo: "98765"` → all three show, "Buy Tokens" selected by default (unchanged from today).
  - `meterNo: "", electricityMeterNo: ""` → only "Pay Rent" shows, as a single full-width pill, already selected.

  Revert `DEMO_CLIENT_TENANT_PROFILE` back to its original blank values (`meterNo: ""`, `electricityMeterNo: ""`) before committing — it's a temporary manual-test aid, not a real change.

- [ ] **Step 9: Commit**

```bash
git add components/client/client-payments-view.tsx
git commit -m "feat: only show payment tabs the tenant has meters for"
```
