/**
 * Buat (atau reset password) akun OWNER, untuk server produksi tanpa data demo.
 *
 *   OWNER_EMAIL=anda@gmail.com OWNER_NAME="Nama Anda" OWNER_PASSWORD='password-kuat' pnpm create-owner
 *
 * Jika email sudah ada, user dijadikan OWNER aktif dan password-nya diganti.
 */
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const db = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const name = process.env.OWNER_NAME?.trim() || "Owner";
  const password = process.env.OWNER_PASSWORD ?? "";
  if (!email || !email.includes("@")) throw new Error("Isi OWNER_EMAIL.");
  if (password.length < 10) throw new Error("OWNER_PASSWORD minimal 10 karakter.");
  if (password === "password123") throw new Error("Jangan pakai password demo.");

  const hash = await hashPassword(password);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { role: "OWNER", isActive: true, outletId: null } });
    const acc = await db.account.findFirst({ where: { userId: existing.id, providerId: "credential" } });
    if (acc) await db.account.update({ where: { id: acc.id }, data: { password: hash } });
    else
      await db.account.create({
        data: { id: crypto.randomBytes(16).toString("hex"), userId: existing.id, accountId: existing.id, providerId: "credential", password: hash },
      });
    console.log(`✅ ${email} sekarang OWNER, password diperbarui.`);
  } else {
    const id = crypto.randomBytes(16).toString("hex");
    await db.user.create({ data: { id, name, email, role: "OWNER", emailVerified: true } });
    await db.account.create({ data: { id: crypto.randomBytes(16).toString("hex"), userId: id, accountId: id, providerId: "credential", password: hash } });
    console.log(`✅ Akun OWNER ${email} dibuat.`);
  }
}

main()
  .catch((e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
