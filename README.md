# 🍽️ Santap POS

Sistem POS F&B modern: customer **scan QR di meja → pesan → bayar (Midtrans) → pantau pesanan live**, dapur menerima pesanan **realtime**, kasir punya **POS lengkap dengan split bill & struk**, dan owner mendapat **laporan penjualan** otomatis.

Dibangun dengan Next.js 15 (App Router) + TypeScript, Prisma + PostgreSQL, Better Auth, Tailwind CSS v4, dan Midtrans Snap. Semua layanan gratis dan berjalan lokal.

---

## ✨ Fitur

| Area | Fitur |
| --- | --- |
| **Customer (HP)** | Menu digital per meja via QR, kategori & pencarian, varian/add-on, catatan per item, keranjang tersimpan, bayar online (QRIS, e-wallet, VA, kartu) atau bayar di kasir, pelacakan status live dengan posisi antrean & estimasi waktu siap, daftar “Pesanan saya”, panggil pelayan / minta bill, menu takeaway (`/m/[outlet]`) |
| **Kasir (POS)** | Grid menu cepat, dine-in (pilih meja + status terisi) / takeaway, open bill, diskon, pembayaran tunai (uang pas & kembalian), QRIS/e-wallet via Midtrans, EDC/kartu/transfer, **split bill** (bagi rata atau per item), **bayar sekaligus per meja**, kurangi/hapus item sebelum dibayar, cetak struk thermal 80mm, kirim struk via WhatsApp, buka/tutup shift dengan rekonsiliasi kas. Tampilan menyesuaikan tablet & HP |
| **Dapur (KDS)** | Layar gelap 3 kolom (antrean → dimasak → siap), timer & warna keterlambatan, rekap total item yang harus dimasak, centang per item, bunyi notifikasi pesanan baru, tandai stok habis |
| **Pelayan** | Konfirmasi pesanan QR “bayar di kasir”, notifikasi panggilan meja, tandai pesanan sudah diantar |
| **Owner** | Dashboard ringkasan, papan pesanan, manajemen menu (kategori, foto upload, varian, add-on, favorit), meja & QR (cetak massal), multi-outlet (pajak, service, teks struk), pengguna & role, laporan (harian, terlaris, kategori, metode bayar, jam ramai) + ekspor CSV |
| **Teknis** | Harga selalu dihitung ulang di server, realtime via SSE, webhook Midtrans terverifikasi signature + cek status otomatis (cocok untuk localhost), PWA (bisa di-install), mode demo pembayaran tanpa key, pembatasan request publik & login, pesanan online yang tak dibayar dibatalkan otomatis setelah 2 jam, unit test |

### Role & akses

| Role | Akses |
| --- | --- |
| `OWNER` | Semua fitur & semua outlet |
| `KASIR` | POS, pembayaran, shift, pesanan, layar dapur, stok |
| `DAPUR` | Layar dapur & stok habis |
| `PELAYAN` | Pesanan, POS (open bill tanpa terima bayar), meja |

---

## 🚀 Menjalankan secara lokal

### Prasyarat
- **Node.js 20+** dan **pnpm** (`npm i -g pnpm`)
- **Docker Desktop** (untuk PostgreSQL). Alternatif: PostgreSQL lokal biasa.

### Langkah

```bash
# 1. Install dependency
pnpm install

# 2. Salin konfigurasi
cp .env.example .env        # Windows: copy .env.example .env

# 3. Jalankan database PostgreSQL
pnpm db:up                  # = docker compose up -d

# 4. Buat tabel + isi data contoh
pnpm db:migrate             # = prisma migrate dev
pnpm db:seed

# 5. Jalankan aplikasi
pnpm dev
```

Buka **http://localhost:3000**.

### Akun demo (password: `password123`)

| Role | Email |
| --- | --- |
| Owner | `owner@santap.id` |
| Kasir | `kasir@santap.id` |
| Dapur | `dapur@santap.id` |
| Pelayan | `pelayan@santap.id` |
| Kasir outlet Dago | `kasir.dago@santap.id` |

Di halaman login (mode development) ada tombol masuk cepat untuk tiap akun. Halaman beranda juga menampilkan link QR meja untuk mencoba sisi customer.

### Mencoba alur lengkap
1. Buka beranda → **Coba sebagai customer** (atau scan QR dari menu **Meja & QR**).
2. Pilih menu, isi nama, pilih **Bayar sekarang** atau **Bayar di kasir**.
3. Di tab lain login sebagai **dapur** → pesanan muncul otomatis di layar dapur.
4. Ubah status di dapur → halaman status customer ikut berubah tanpa refresh.
5. Login **kasir** → `/pos` untuk pesanan walk-in, split bill, dan cetak struk.

---

## 📱 Scan QR dari HP (jaringan Wi-Fi yang sama)

Secara default QR mengarah ke `localhost` yang tidak bisa dibuka dari HP. Caranya:

1. Cari IP laptop: `ipconfig` (Windows) / `ifconfig` atau `ip a` (Mac/Linux), mis. `192.168.1.10`.
2. Ubah di `.env`:
   ```env
   NEXT_PUBLIC_APP_URL="http://192.168.1.10:3000"
   BETTER_AUTH_URL="http://192.168.1.10:3000"
   ```
3. Restart `pnpm dev`, lalu buka dashboard lewat `http://192.168.1.10:3000` dan cetak ulang QR.

---

## 💳 Midtrans (Sandbox, gratis)

Tanpa key, aplikasi berjalan dalam **mode demo**: tombol bayar membuka dialog simulasi (berhasil/gagal) sehingga seluruh alur tetap bisa dicoba.

Untuk memakai Midtrans Sandbox sungguhan:
1. Daftar di <https://dashboard.sandbox.midtrans.com> (gratis).
2. **Settings → Access Keys**, salin **Server Key** dan **Client Key** ke `.env`:
   ```env
   MIDTRANS_SERVER_KEY="SB-Mid-server-xxxx"
   NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="SB-Mid-client-xxxx"
   ```
3. Restart server. Popup Snap akan muncul saat customer/kasir menekan bayar. Gunakan [simulator pembayaran sandbox](https://simulator.sandbox.midtrans.com) untuk “membayar” QRIS/VA.

**Status pembayaran di localhost:** webhook Midtrans tidak bisa menjangkau `localhost`, jadi aplikasi otomatis **mengecek status transaksi ke API Midtrans** setiap beberapa detik selama ada pembayaran tertunda. Tidak perlu setup tambahan.

Jika nanti punya URL publik, isi **Payment Notification URL** di dashboard Midtrans dengan `https://<domain>/api/midtrans/notification` (signature diverifikasi dengan SHA-512).

---

## 🧭 Alur status pesanan

```
Customer QR ─┬─ Bayar sekarang ─→ PENDING ──(Midtrans sukses)──┐
             └─ Bayar di kasir ─→ PENDING ──(staf konfirmasi)──┤
Kasir POS ───────────────────────────────────────────────────→ CONFIRMED → PREPARING → READY → COMPLETED
                                                                      (dapur)     (dapur)  (diantar)
```

- Status pembayaran terpisah: `UNPAID → PARTIAL → PAID` (mendukung split bill & open bill).
- Pesanan dibatalkan hanya jika belum dibayar, kecuali oleh owner (otomatis ditandai refund).

---

## 🗂️ Struktur proyek

```
prisma/
  schema.prisma        # model data
  seed.ts              # data contoh: 2 outlet, 23 menu, 14 hari transaksi
src/
  app/
    (customer)/        # /t/[token] menu meja, /m/[slug] takeaway, /order/[id] status
    (staff)/           # /dashboard/*, /pos, /kitchen, /print/tables
    api/               # auth, SSE stream, webhook & sync Midtrans, QR, upload, ekspor CSV
    receipt/[id]       # struk thermal 80mm
    login/
  components/          # ui/ (komponen dasar), customer/, staff/, menu/, shared/
  server/              # logika bisnis: orders, pricing, midtrans, reports, server actions
  lib/                 # auth, db, session, events (SSE bus), utils
```

## 🛠️ Perintah berguna

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Jalankan mode development |
| `pnpm build && pnpm start` | Jalankan mode produksi lokal |
| `pnpm db:seed` | Isi ulang data contoh (menghapus data lama) |
| `pnpm db:reset` | Reset database + migrasi + seed |
| `pnpm db:studio` | Lihat isi database di browser (Prisma Studio) |
| `pnpm test` | Unit test (perhitungan total, split bill, Midtrans) |
| `pnpm typecheck` / `pnpm lint` | Pemeriksaan kode |

## 📝 Catatan

- Realtime memakai Server-Sent Events dengan event bus di memori: cocok untuk satu server (lokal / single instance).
- Foto menu yang di-upload tersimpan di folder `uploads/` (tidak ikut git).
- Zona waktu laporan & nomor antrean harian diatur lewat `APP_TIMEZONE` (default `Asia/Jakarta`).
