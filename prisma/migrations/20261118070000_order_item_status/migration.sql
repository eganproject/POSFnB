-- Status per item di dapur. Aman untuk data lama: tidak ada baris yang dihapus.

-- 1) Enum & kolom baru
CREATE TYPE "OrderItemStatus" AS ENUM ('QUEUED', 'PREPARING', 'READY', 'SERVED');

ALTER TABLE "OrderItem"
  ADD COLUMN "status" "OrderItemStatus" NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "readyAt" TIMESTAMP(3),
  ADD COLUMN "servedAt" TIMESTAMP(3);

-- 2) Petakan data lama (status pesanan + centang dapur "isDone") ke status item
--    COMPLETED          -> semua item Diantar
--    READY              -> semua item Siap
--    item dicentang     -> Siap
--    PREPARING          -> Disiapkan
--    lainnya            -> Antre (PENDING, CONFIRMED, CANCELLED)
UPDATE "OrderItem" i
SET
  "status" = CASE
    WHEN o."status" = 'COMPLETED' THEN 'SERVED'::"OrderItemStatus"
    WHEN o."status" = 'READY' THEN 'READY'::"OrderItemStatus"
    WHEN i."isDone" AND o."status" <> 'PENDING' THEN 'READY'::"OrderItemStatus"
    WHEN o."status" = 'PREPARING' THEN 'PREPARING'::"OrderItemStatus"
    ELSE 'QUEUED'::"OrderItemStatus"
  END
FROM "Order" o
WHERE o."id" = i."orderId";

-- Cap waktu item dari cap waktu pesanan (perkiraan terbaik untuk data lama)
UPDATE "OrderItem" i
SET
  "startedAt" = CASE WHEN i."status" <> 'QUEUED' THEN COALESCE(o."preparingAt", o."confirmedAt", o."createdAt") END,
  "readyAt"   = CASE WHEN i."status" IN ('READY', 'SERVED') THEN COALESCE(o."readyAt", o."completedAt", o."updatedAt") END,
  "servedAt"  = CASE WHEN i."status" = 'SERVED' THEN COALESCE(o."completedAt", o."updatedAt") END
FROM "Order" o
WHERE o."id" = i."orderId";

-- 3) Selaraskan status pesanan yang sedang berjalan dengan aturan baru
--    (status pesanan = turunan dari item). Pesanan PENDING/COMPLETED/CANCELLED tidak disentuh.
WITH agg AS (
  SELECT
    i."orderId",
    bool_and(i."status" = 'SERVED') AS all_served,
    bool_and(i."status" IN ('READY', 'SERVED')) AS all_done,
    bool_and(i."status" = 'QUEUED') AS all_queued
  FROM "OrderItem" i
  GROUP BY i."orderId"
),
derived AS (
  SELECT o."id",
    CASE
      WHEN a.all_served THEN 'COMPLETED'::"OrderStatus"
      WHEN a.all_done THEN 'READY'::"OrderStatus"
      WHEN a.all_queued THEN 'CONFIRMED'::"OrderStatus"
      ELSE 'PREPARING'::"OrderStatus"
    END AS next
  FROM "Order" o
  JOIN agg a ON a."orderId" = o."id"
  WHERE o."status" IN ('CONFIRMED', 'PREPARING', 'READY')
)
UPDATE "Order" o
SET
  "status" = d.next,
  "preparingAt" = CASE WHEN d.next IN ('PREPARING', 'READY', 'COMPLETED') THEN COALESCE(o."preparingAt", CURRENT_TIMESTAMP) ELSE o."preparingAt" END,
  "readyAt" = CASE WHEN d.next IN ('READY', 'COMPLETED') THEN COALESCE(o."readyAt", CURRENT_TIMESTAMP) ELSE o."readyAt" END
FROM derived d
WHERE d."id" = o."id" AND d.next <> o."status";

-- 4) Kolom lama diganti "status"
ALTER TABLE "OrderItem" DROP COLUMN "isDone";

-- 5) Index untuk query dapur
CREATE INDEX "OrderItem_orderId_status_idx" ON "OrderItem"("orderId", "status");
