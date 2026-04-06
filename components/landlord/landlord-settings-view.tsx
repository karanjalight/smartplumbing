"use client";

import { Switch } from "@base-ui/react/switch";
import { Building2, Lock, Mail, Settings, Shield } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLandlordSettingsStore } from "@/components/landlord/use-landlord-settings-store";
import { getLandlordRows } from "@/lib/landlords-data";
import { writeLandlordSettings, type LandlordPortalSettings } from "@/lib/landlord-settings-storage";
import { cn } from "@/lib/utils";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0 dark:border-border/80">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "data-[checked]:bg-[#0A4266] data-[checked]:dark:bg-[#6BB4E8]",
          "data-[unchecked]:bg-muted"
        )}
      >
        <Switch.Thumb
          className={cn(
            "pointer-events-none absolute top-0.5 left-0.5 block size-6 rounded-full bg-white shadow transition-transform",
            "data-[checked]:translate-x-5 data-[unchecked]:translate-x-0"
          )}
        />
      </Switch.Root>
    </div>
  );
}

function patchSettings(partial: Partial<LandlordPortalSettings>) {
  writeLandlordSettings(partial);
}

export function LandlordSettingsView({ landlordId }: { landlordId: string }) {
  const settings = useLandlordSettingsStore();
  const landlord = useMemo(() => getLandlordRows().find((l) => l.id === landlordId), [landlordId]);

  const [payoutEmail, setPayoutEmail] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [till, setTill] = useState("");
  const [bank, setBank] = useState("");

  useEffect(() => {
    if (!settings) return;
    setPayoutEmail(settings.contactEmail);
    setPayoutPhone(settings.contactPhone);
    setTill(settings.mpesaTillLabel);
    setBank(settings.bankAccountLabel);
  }, [settings]);

  function savePayoutContacts() {
    writeLandlordSettings({
      contactEmail: payoutEmail.trim(),
      contactPhone: payoutPhone.trim(),
      mpesaTillLabel: till.trim(),
      bankAccountLabel: bank.trim(),
    });
    toast.success("Payout contacts saved", { description: "Stored in this browser for demo purposes." });
  }

  return (
    <div className="space-y-10 pb-12">
      <div>
        <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
          <Settings className="size-8" />
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Profile information comes from your landlord record. Notification toggles and payout labels are saved locally in
          this browser (demo until backend auth and APIs are connected).
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm dark:border-border/80">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15">
            <Building2 className="size-6 text-[#0A4266] dark:text-[#6BB4E8]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground">Account profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{landlord?.company ?? "Landlord"}</span>
            </p>
            {landlord && (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Contact name</dt>
                  <dd className="mt-0.5 text-foreground">{landlord.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Region</dt>
                  <dd className="mt-0.5 text-foreground">{landlord.region}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Phone</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{landlord.phone}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                  <dd className="mt-0.5 text-foreground">{landlord.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Payout schedule</dt>
                  <dd className="mt-0.5 capitalize text-foreground">{landlord.payoutSchedule}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Next payout</dt>
                  <dd className="mt-0.5 text-foreground">{landlord.nextPayoutDate}</dd>
                </div>
              </dl>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm dark:border-border/80">
        <FieldGroup className="gap-4">
          <div>
            <FieldTitle className="text-foreground">Notifications</FieldTitle>
            <FieldDescription>Choose how we reach you about meters, tenants, and settlements.</FieldDescription>
          </div>
          <ToggleRow
            label="Email notifications"
            description="Faults, failed payments, and payout confirmations."
            checked={settings.notifyEmail}
            onChange={(v) => patchSettings({ notifyEmail: v })}
          />
          <ToggleRow
            label="SMS alerts"
            description="Critical meter faults and overdue rent (carrier rates apply)."
            checked={settings.notifySms}
            onChange={(v) => patchSettings({ notifySms: v })}
          />
          <ToggleRow
            label="Browser push"
            description="Real-time alerts when this portal is open."
            checked={settings.notifyPush}
            onChange={(v) => patchSettings({ notifyPush: v })}
          />
          <ToggleRow
            label="Weekly digest"
            description="Summary of collections and meter health every Monday."
            checked={settings.digestWeekly}
            onChange={(v) => patchSettings({ digestWeekly: v })}
          />
        </FieldGroup>
        <Separator className="my-6" />
        <FieldGroup className="gap-0">
          <div className="mb-3">
            <FieldTitle className="text-base text-foreground">Alert categories</FieldTitle>
            <FieldDescription>Filter which issues generate notifications.</FieldDescription>
          </div>
          <ToggleRow
            label="Meter faults & maintenance"
            checked={settings.alertMeterFault}
            onChange={(v) => patchSettings({ alertMeterFault: v })}
            description="STS faults, valve checks, and scheduled maintenance."
          />
          <ToggleRow
            label="Connectivity (offline / intermittent)"
            checked={settings.alertMeterOffline}
            onChange={(v) => patchSettings({ alertMeterOffline: v })}
            description="When a meter stops reporting."
          />
          <ToggleRow
            label="Failed payments"
            checked={settings.alertPaymentFailed}
            onChange={(v) => patchSettings({ alertPaymentFailed: v })}
            description="M-Pesa or bank rejections on tenant charges."
          />
          <ToggleRow
            label="Tenant arrears & low credit"
            checked={settings.alertTenantArrears}
            onChange={(v) => patchSettings({ alertTenantArrears: v })}
            description="Overdue rent and low STS balance."
          />
        </FieldGroup>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm dark:border-border/80">
        <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Theme applies across the landlord portal and admin dashboard.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">Light / dark mode</span>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-sm dark:border-border/80">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Payout & settlement labels</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use these notes for your own reconciliation. They do not change platform payout rails — edit display labels
              only.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sett-email">Notification email (override)</Label>
                <Input
                  id="sett-email"
                  type="email"
                  value={payoutEmail}
                  placeholder={landlord?.email ?? "finance@example.co.ke"}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sett-phone">SMS / WhatsApp number</Label>
                <Input
                  id="sett-phone"
                  value={payoutPhone}
                  placeholder={landlord?.phone ?? "+254 …"}
                  onChange={(e) => setPayoutPhone(e.target.value)}
                  className="rounded-full font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sett-till">M-Pesa till / paybill label</Label>
                <Input
                  id="sett-till"
                  value={till}
                  placeholder="e.g. B2B till 123456"
                  onChange={(e) => setTill(e.target.value)}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sett-bank">Bank account label</Label>
                <Input
                  id="sett-bank"
                  value={bank}
                  placeholder="e.g. Equity Bank · ****9012"
                  onChange={(e) => setBank(e.target.value)}
                  className="rounded-full"
                />
              </div>
            </div>
            <Button
              type="button"
              className="mt-4 rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
              onClick={savePayoutContacts}
            >
              Save payout labels
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-6 dark:border-border/80">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Security</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Password change and two-factor authentication will be available when landlord login is backed by your auth
              provider.
            </p>
            <Button type="button" variant="outline" className="mt-4 rounded-full gap-2" disabled>
              <Lock className="size-4" />
              Change password (soon)
            </Button>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Need help?{" "}
        <Link href="/landlords/dashboard/help" className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]">
          Open help centre
        </Link>
      </p>
    </div>
  );
}
