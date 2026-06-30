import { round2 } from "@/lib/billing/money";

/** A collected payment, tagged with the building's management-fee %. */
export type CollectedLine = { amount: number; feePct: number };

export type OwnerStatementInput = {
  period: string; // YYYYMM
  collected: CollectedLine[];
  billedTotal: number;
  expenses: { category: string; amount: number }[];
};

export type OwnerStatement = {
  period: string;
  grossCollected: number;
  grossBilled: number;
  collectionRate: number; // 0..1 (collected / billed)
  managementFee: number;
  expensesTotal: number;
  expensesByCategory: Record<string, number>;
  netToOwner: number;
};

/**
 * Owner distribution for a period (cash basis): net = collected − management
 * fee − expenses. The management fee is applied per payment using the fee % of
 * the building that payment belongs to.
 */
export function computeOwnerStatement(input: OwnerStatementInput): OwnerStatement {
  const grossCollected = round2(
    input.collected.reduce((sum, c) => sum + c.amount, 0)
  );
  const managementFee = round2(
    input.collected.reduce((sum, c) => sum + (c.amount * c.feePct) / 100, 0)
  );

  const expensesByCategory: Record<string, number> = {};
  let expensesTotal = 0;
  for (const e of input.expenses) {
    expensesByCategory[e.category] = round2(
      (expensesByCategory[e.category] ?? 0) + e.amount
    );
    expensesTotal += e.amount;
  }
  expensesTotal = round2(expensesTotal);

  return {
    period: input.period,
    grossCollected,
    grossBilled: round2(input.billedTotal),
    collectionRate: input.billedTotal > 0 ? round2(grossCollected / input.billedTotal) : 0,
    managementFee,
    expensesTotal,
    expensesByCategory,
    netToOwner: round2(grossCollected - managementFee - expensesTotal),
  };
}
