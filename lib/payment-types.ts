export type PaymentType = "water" | "electricity" | "rent";

export function getAvailablePaymentTypes(profile: {
  meterNo: string;
  electricityMeterNo: string;
}): PaymentType[] {
  const types: PaymentType[] = [];
  if (profile.meterNo.trim()) types.push("water");
  if (profile.electricityMeterNo.trim()) types.push("electricity");
  types.push("rent");
  return types;
}
