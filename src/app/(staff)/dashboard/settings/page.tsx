import Link from "next/link";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/staff/page-header";
import { decryptSecret, getAppConfig, maskSecret, readSettingsRow } from "@/server/settings";
import { SettingsForms } from "./settings-forms";

export const metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser(["OWNER"]);
  const [row, config] = await Promise.all([readSettingsRow(), getAppConfig()]);
  const authBase = (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const appBase = (process.env.NEXT_PUBLIC_APP_URL || authBase).replace(/\/$/, "");
  const storedServerKey = decryptSecret(row?.midtransServerKey);
  const storedGoogleSecret = decryptSecret(row?.googleClientSecret);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description={
          <>
            Pembayaran online (Midtrans) dan login Google pelanggan. Pajak, service charge, jam buka & takeaway diatur per cabang di{" "}
            <Link href="/dashboard/outlets" className="font-semibold text-primary underline-offset-4 hover:underline">Outlet</Link>.
          </>
        }
      />
      <SettingsForms
        midtrans={{
          source: config.midtrans.source,
          isProduction: config.midtrans.isProduction,
          storedServerKeyMasked: maskSecret(storedServerKey),
          storedServerKeyBroken: Boolean(row?.midtransServerKey && !storedServerKey),
          storedClientKey: row?.midtransClientKey ?? "",
          storedIsProduction: row?.midtransIsProduction ?? false,
          webhookUrl: `${appBase}/api/midtrans/notification`,
          finishUrl: `${appBase}/order`,
        }}
        paymentMode={{
          mode: config.midtrans.mode,
          modeFromSettings: row?.midtransMode === "snap" || row?.midtransMode === "core",
          channels: config.midtrans.coreChannels,
          status: config.midtrans.channelStatus,
          keysReady: config.midtrans.enabled,
          isProduction: config.midtrans.isProduction,
        }}
        google={{
          source: config.google.source,
          storedClientId: row?.googleClientId ?? "",
          storedSecretMasked: maskSecret(storedGoogleSecret),
          storedSecretBroken: Boolean(row?.googleClientSecret && !storedGoogleSecret),
          redirectUri: `${authBase}/api/auth/callback/google`,
          origin: authBase,
        }}
        updatedAt={row?.updatedAt.toISOString() ?? null}
      />
    </div>
  );
}
