-- Apply schema changes and historical backfills atomically.
BEGIN;

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiresPreparation" BOOLEAN;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cashReceived" DECIMAL(10,2),
ADD COLUMN     "changeGiven" DECIMAL(10,2),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "couponId" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountType" "DiscountType",
ADD COLUMN     "discountValue" DECIMAL(10,2),
ADD COLUMN     "orderType" "OrderType",
ADD COLUMN     "subtotal" DECIMAL(10,2),
ADD COLUMN     "tableNumber" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "categoryName" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lineSubtotal" DECIMAL(10,2),
ADD COLUMN     "lineTotal" DECIMAL(10,2),
ADD COLUMN     "orderDealId" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "requiresPreparation" BOOLEAN;

-- Legacy checkout had no discount or order-type/cash fields. Preserve the
-- recorded total and unit prices; do not guess order type or cash received.
UPDATE "Order" SET "subtotal" = "totalAmount";

-- The old app did not record completion events. Leave completedAt NULL for
-- history; future reports must explicitly fall back to createdAt for old rows.
UPDATE "OrderItem" AS item
SET "productName" = product."name",
    "categoryName" = category."name",
    "requiresPreparation" = category."requiresPreparation",
    "lineSubtotal" = item."priceAtTime" * item."quantity",
    "lineTotal" = item."priceAtTime" * item."quantity"
FROM "Product" AS product
JOIN "Category" AS category ON category."id" = product."categoryId"
WHERE item."productId" = product."id";

ALTER TABLE "Order" ALTER COLUMN "subtotal" SET NOT NULL;
ALTER TABLE "OrderItem"
    ALTER COLUMN "productName" SET NOT NULL,
    ALTER COLUMN "categoryName" SET NOT NULL,
    ALTER COLUMN "requiresPreparation" SET NOT NULL,
    ALTER COLUMN "lineSubtotal" SET NOT NULL,
    ALTER COLUMN "lineTotal" SET NOT NULL;

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minimumSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDeal" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dealId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealItem_productId_idx" ON "DealItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "DealItem_dealId_productId_key" ON "DealItem"("dealId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "OrderDeal_orderId_idx" ON "OrderDeal"("orderId");

-- CreateIndex
CREATE INDEX "OrderDeal_dealId_idx" ON "OrderDeal"("dealId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");

-- CreateIndex
CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderItem_orderDealId_idx" ON "OrderItem"("orderDealId");

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDeal" ADD CONSTRAINT "OrderDeal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDeal" ADD CONSTRAINT "OrderDeal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderDealId_fkey" FOREIGN KEY ("orderDealId") REFERENCES "OrderDeal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not express CHECK constraints; keep these in migration history.
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_price_check" CHECK ("price" >= 0);
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "OrderDeal" ADD CONSTRAINT "OrderDeal_values_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_rules_check" CHECK (
    "code" ~ '^[A-Z0-9_-]{1,40}$'
    AND "minimumSubtotal" >= 0
    AND "value" >= 0
    AND ("discountType" <> 'PERCENTAGE' OR "value" <= 100)
);

COMMIT;
