-- AlterTable
ALTER TABLE "Item" ADD COLUMN "purchasePrice" REAL;

-- AlterTable
ALTER TABLE "Release" ADD COLUMN "lowestPrice" REAL;
ALTER TABLE "Release" ADD COLUMN "numForSale" INTEGER;
