-- DropForeignKey
ALTER TABLE "ReviewVerificationToken" DROP CONSTRAINT "ReviewVerificationToken_repairJobId_fkey";

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "orderId" TEXT;

-- AlterTable
ALTER TABLE "ReviewVerificationToken" ADD COLUMN     "codeEncrypted" TEXT,
ADD COLUMN     "orderId" TEXT,
ALTER COLUMN "repairJobId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "ReviewVerificationToken_orderId_idx" ON "ReviewVerificationToken"("orderId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVerificationToken" ADD CONSTRAINT "ReviewVerificationToken_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVerificationToken" ADD CONSTRAINT "ReviewVerificationToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

