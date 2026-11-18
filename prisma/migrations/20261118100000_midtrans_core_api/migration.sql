-- Pilihan mode Midtrans (Snap / Core API) dan data tampilan pembayaran Core API
ALTER TABLE "AppSettings" ADD COLUMN "midtransMode" TEXT,
ADD COLUMN "midtransCoreChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "midtransChannelStatus" JSONB;

ALTER TABLE "Payment" ADD COLUMN "gatewayChannel" TEXT,
ADD COLUMN "gatewayMode" TEXT,
ADD COLUMN "gatewayAction" JSONB,
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "splitItems" JSONB;

-- Transaksi lama semuanya lewat Snap
UPDATE "Payment" SET "gatewayMode" = 'snap' WHERE "method" = 'MIDTRANS' AND "snapToken" IS NOT NULL AND "snapToken" NOT LIKE 'demo-%';
UPDATE "Payment" SET "gatewayChannel" = "gatewayType" WHERE "method" = 'MIDTRANS' AND "gatewayType" IS NOT NULL;
