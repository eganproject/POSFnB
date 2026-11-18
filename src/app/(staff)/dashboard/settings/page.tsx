import Link from "next/link";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/staff/page-header";
import { decryptSecret, getAppConfig, maskSecret, readSettingsRow } from "@/server/settings";
import { SettingsForms } from "./settings-forms";
import { Prisma } from "@prisma/client";

/** Kolom / tabel belum ada di database = migrasi terbaru belum dijalankan */
function isMissingMigration(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022");
}

export const metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUser(["OWNER"]);
  let row: Awaited<ReturnType<typeof readSettingsRow>>;
  try {
    row = await readSettingsRow();
  } catch (e) {
    if (!isMissingMigration(e)) throw e;
    console.error("Pengaturan: database belum dimigrasi", e);
    return (
      <div className="space-y-6">
        <PageHeader title="Pengaturan" description="Pembayaran online (Midtrans) dan login Google pelanggan." />
        <section className="max-w-2xl space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="font-bold">Database belum diperbarui</h2>
          <p className="text-sm text-muted-foreground">
            Versi aplikasi ini butuh kolom baru di database, tapi migrasinya belum dijalankan. Jalankan perintah ini di folder aplikasi,
            lalu restart aplikasi:
          </p>
          <pre className="overflow-x-auto rounded-xl bg-foreground p-3 text-xs text-background">pnpm prisma migrate deploy</pre>
          <p className="text-xs text-muted-foreground">Tidak menghapus data. Jangan jalankan db:seed.</p>
        </section>
      </div>
    );
  }
  const config = await getAppConfig();
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
