import { OnboardMeterView } from "@/components/dashboard/onboard-meter-view";

export const metadata = {
  title: "Onboard Meter — Mali Smart Admin",
  description:
    "Register and provision STS meters, then assign landlord, building, tenant, and unit.",
};

export default function OnboardMeterPage() {
  return <OnboardMeterView />;
}
