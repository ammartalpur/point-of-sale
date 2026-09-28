ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_modifierId_fkey";

ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_modifierId_fkey"
FOREIGN KEY ("modifierId") REFERENCES "ProductModifier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
