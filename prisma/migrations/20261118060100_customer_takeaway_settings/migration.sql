-- Semua perubahan bersifat tambahan: data lama tidak diubah atau dihapus.

-- Pesanan: tautan ke akun pelanggan & jam ambil takeaway
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT,
ADD COLUMN "pickupAt" TIMESTAMP(3);

-- Outlet: pengaturan takeaway (nilai default untuk outlet yang sudah ada)
ALTER TABLE "Outlet" ADD COLUMN "closeTime" TEXT NOT NULL DEFAULT '22:00',
ADD COLUMN "openTime" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN "takeawayEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "takeawayLeadMinutes" INTEGER NOT NULL DEFAULT 15;

-- User: no. WhatsApp pelanggan. Default role user BARU = CUSTOMER agar akun Google
-- yang daftar sendiri tidak pernah mendapat akses staf. Role staf lama tidak berubah.
ALTER TABLE "user" ADD COLUMN "phone" TEXT,
ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

-- Pengaturan aplikasi (satu baris)
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "midtransServerKey" TEXT,
    "midtransClientKey" TEXT,
    "midtransIsProduction" BOOLEAN,
    "googleClientId" TEXT,
    "googleClientSecret" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
