import { getBuildings } from "@/lib/buildings-data";
import {
  buildMeterRowFromTenant,
  getMeterRows,
  type MeterRow,
} from "@/lib/meters-data";
import {
  getLandlordBuildingsMerged,
  getLandlordTenantsMerged,
  type PortfolioStore,
} from "@/lib/landlord-portfolio-storage";
import { MOCK_LANDLORDS } from "@/lib/tenants-data";

/** Meters for a landlord: seed rows + any tenant-added in portfolio without a seed row. */
export function getLandlordMeterRowsMerged(
  landlordId: string,
  store: PortfolioStore
): MeterRow[] {
  const byMeter = new Map<string, MeterRow>();
  for (const r of getMeterRows()) {
    if (r.landlordId === landlordId) byMeter.set(r.meterId, r);
  }

  const tenants = getLandlordTenantsMerged(landlordId, store);
  const mergedBuildings = getLandlordBuildingsMerged(landlordId, store);
  const adminBuildings = getBuildings();
  const resolveBuildingsForLookup = (): ReturnType<typeof getBuildings> => {
    const byId = new Map(mergedBuildings.map((b) => [b.id, b]));
    for (const b of adminBuildings) {
      if (!byId.has(b.id)) byId.set(b.id, b);
    }
    return Array.from(byId.values());
  };
  const lookupBuildings = resolveBuildingsForLookup();

  const ll = MOCK_LANDLORDS.find((l) => l.id === landlordId);
  const company = ll?.company ?? null;

  for (const t of tenants) {
    if (byMeter.has(t.meterId)) continue;
    if (!t.meterId || t.meterId === "—") continue;
    byMeter.set(t.meterId, buildMeterRowFromTenant(t, lookupBuildings, company));
  }

  return Array.from(byMeter.values()).sort((a, b) => a.meterId.localeCompare(b.meterId));
}
