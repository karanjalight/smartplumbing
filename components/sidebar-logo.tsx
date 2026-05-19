import { BrandLogo } from "@/components/brand-logo";

type SidebarLogoProps = {
  compact?: boolean;
};

export function SidebarLogo({ compact = false }: SidebarLogoProps) {
  return (
    <BrandLogo
      variant={compact ? "compact" : "sidebar"}
      priority
      withSurface={false}
    />
  );
}
