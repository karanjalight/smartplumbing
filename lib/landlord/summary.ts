export type PortfolioCounts = {
  buildings: number;
  units: number;
  meters: number;
  metersOnline: number;
  tenants: number;
  tenantsActive: number;
};

export function summarizePortfolio(input: {
  buildings: { id: string }[];
  units: { id: string }[];
  meters: { connectivity_status: string | null }[];
  tenants: { status: string | null }[];
}): PortfolioCounts {
  return {
    buildings: input.buildings.length,
    units: input.units.length,
    meters: input.meters.length,
    metersOnline: input.meters.filter((m) => m.connectivity_status === "online").length,
    tenants: input.tenants.length,
    tenantsActive: input.tenants.filter((t) => t.status === "active").length,
  };
}
