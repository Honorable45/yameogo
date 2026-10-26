-- CreateEnum
CREATE TYPE "PhoneCondition" AS ENUM ('NEW', 'IMPORTED', 'USED');

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "phonesImageAlt" TEXT,
ADD COLUMN     "phonesImageUrl" TEXT;

-- AlterTable
ALTER TABLE "UsedPhone" ADD COLUMN     "condition" "PhoneCondition" NOT NULL DEFAULT 'USED';

-- CreateIndex
CREATE INDEX "UsedPhone_condition_status_idx" ON "UsedPhone"("condition", "status");
