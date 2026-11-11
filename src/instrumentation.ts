/**
 * Dijalankan sekali saat server Next.js menyala (bukan saat build).
 * Di produksi, server menolak jalan jika secret login masih kosong / contoh,
 * karena siapa pun yang tahu secret itu bisa memalsukan sesi login.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  const placeholders = ["ganti-dengan-string-acak-minimal-32-karakter", "changeme", "secret"];
  if (!secret || secret.length < 32 || placeholders.includes(secret)) {
    throw new Error(
      "BETTER_AUTH_SECRET belum diganti. Isi .env dengan string acak minimal 32 karakter (openssl rand -base64 32) lalu jalankan ulang."
    );
  }
  if (process.env.ALLOW_DEMO_PAYMENT === "true") {
    console.warn("⚠️  ALLOW_DEMO_PAYMENT=true: siapa pun bisa menandai pesanan lunas tanpa membayar. Jangan dipakai untuk toko sungguhan.");
  }
}
