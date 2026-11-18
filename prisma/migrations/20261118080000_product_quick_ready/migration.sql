-- Menu yang di layar dapur sekali ketuk langsung Siap
ALTER TABLE "Product" ADD COLUMN "quickReady" BOOLEAN NOT NULL DEFAULT false;
