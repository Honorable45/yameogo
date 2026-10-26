-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'SELLER');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('PHONE', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "PhoneCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INITIAL', 'PURCHASE', 'PURCHASE_CANCEL', 'SALE', 'SALE_RETURN', 'ADJUSTMENT', 'COUNT');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE', 'IN_STORE');

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentPreference" AS ENUM ('PAY_IN_STORE', 'CASH_ON_DELIVERY', 'TMONEY', 'FLOOZ');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TMONEY', 'FLOOZ', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'ELECTRICITY', 'INTERNET', 'TRANSPORT', 'SALARIES', 'EQUIPMENT_MAINTENANCE', 'SUPPLIES', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ReviewService" AS ENUM ('ACCESSORY_PURCHASE', 'PHONE_PURCHASE', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "shopName" TEXT NOT NULL DEFAULT 'YAMEOGO',
    "tagline" TEXT,
    "logoUrl" TEXT,
    "heroImageUrl" TEXT,
    "heroImageAlt" TEXT,
    "phonesImageUrl" TEXT,
    "phonesImageAlt" TEXT,
    "shopImageUrl" TEXT,
    "shopImageAlt" TEXT,
    "tiktokUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "country" TEXT,
    "mapUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "legalName" TEXT,
    "legalForm" TEXT,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "publicationDirector" TEXT,
    "hostingProvider" TEXT,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "deliveryArea" TEXT,
    "deliveryInfo" TEXT,
    "cashOnDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payInStoreEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mobileMoneyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHour" (
    "id" SERIAL NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TEXT,
    "closesAt" TEXT,

    CONSTRAINT "OpeningHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'ACCESSORY',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandId" TEXT,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "specs" JSONB NOT NULL DEFAULT '[]',
    "optionName" TEXT,
    "compatibleWith" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'ACCESSORY',
    "groupId" TEXT NOT NULL,
    "color" TEXT,
    "colorHex" TEXT,
    "ramGb" INTEGER,
    "storageGb" INTEGER,
    "condition" "PhoneCondition",
    "optionValue" TEXT,
    "compareAtPrice" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "salePrice" INTEGER NOT NULL,
    "averageCost" INTEGER NOT NULL DEFAULT 0,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 2,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "color" TEXT,
    "url" TEXT,
    "storageKey" TEXT,
    "alt" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "averageCostAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "purchaseItemId" TEXT,
    "orderItemId" TEXT,
    "orderReturnId" TEXT,
    "countLineId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expected" INTEGER NOT NULL,
    "counted" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "extraCosts" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "SettlementStatus" NOT NULL DEFAULT 'UNPAID',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "allocatedExtra" INTEGER NOT NULL DEFAULT 0,
    "landedUnitCost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePayment" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "fulfillment" "FulfillmentMethod" NOT NULL DEFAULT 'PICKUP',
    "deliveryAddress" TEXT,
    "paymentPreference" "PaymentPreference" NOT NULL,
    "comment" TEXT,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "SettlementStatus" NOT NULL DEFAULT 'UNPAID',
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "unitCost" INTEGER,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "costAmount" INTEGER NOT NULL,
    "restocked" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL DEFAULT 'PAYMENT',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "providerReference" TEXT,
    "externalReference" TEXT,
    "payerPhone" TEXT,
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "receiptKey" TEXT,
    "comment" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedById" TEXT,
    "replacesId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "ratingWelcome" INTEGER,
    "ratingValue" INTEGER,
    "comment" TEXT,
    "displayName" TEXT,
    "serviceType" "ReviewService" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "moderationNote" TEXT,
    "shopReply" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewVerificationToken" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeEncrypted" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHour_dayOfWeek_key" ON "OpeningHour"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroup_slug_key" ON "ProductGroup"("slug");

-- CreateIndex
CREATE INDEX "ProductGroup_kind_status_published_idx" ON "ProductGroup"("kind", "status", "published");

-- CreateIndex
CREATE INDEX "ProductGroup_brandId_idx" ON "ProductGroup"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_kind_status_published_idx" ON "Product"("kind", "status", "published");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_groupId_position_idx" ON "Product"("groupId", "position");

-- CreateIndex
CREATE INDEX "ProductImage_groupId_position_idx" ON "ProductImage"("groupId", "position");

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_createdAt_idx" ON "InventoryMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_createdAt_idx" ON "InventoryMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryCountLine_productId_idx" ON "InventoryCountLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_number_key" ON "Purchase"("number");

-- CreateIndex
CREATE INDEX "Purchase_status_purchaseDate_idx" ON "Purchase"("status", "purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturn_createdAt_idx" ON "OrderReturn"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_confirmedAt_idx" ON "Payment"("status", "confirmedAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerReference_key" ON "Payment"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_replacesId_key" ON "Expense"("replacesId");

-- CreateIndex
CREATE INDEX "Expense_status_expenseDate_idx" ON "Expense"("status", "expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVerificationToken_codeHash_key" ON "ReviewVerificationToken"("codeHash");

-- CreateIndex
CREATE INDEX "ReviewVerificationToken_orderId_idx" ON "ReviewVerificationToken"("orderId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroup" ADD CONSTRAINT "ProductGroup_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroup" ADD CONSTRAINT "ProductGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVerificationToken" ADD CONSTRAINT "ReviewVerificationToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVerificationToken" ADD CONSTRAINT "ReviewVerificationToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ───────────────────────── Contraintes métier (garde-fous au niveau de la base)
ALTER TABLE "Product" ADD CONSTRAINT "product_stock_non_negative" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_reserved_non_negative" CHECK ("reservedQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_prices_non_negative" CHECK ("salePrice" >= 0 AND "averageCost" >= 0);
-- Prix barré : uniquement s'il est supérieur au prix de vente.
ALTER TABLE "Product" ADD CONSTRAINT "product_compare_at_price" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" > "salePrice");
ALTER TABLE "Product" ADD CONSTRAINT "product_variant_values" CHECK (("ramGb" IS NULL OR "ramGb" > 0) AND ("storageGb" IS NULL OR "storageGb" > 0) AND ("colorHex" IS NULL OR "colorHex" ~ '^#[0-9A-Fa-f]{6}$'));
ALTER TABLE "OrderItem" ADD CONSTRAINT "order_item_quantity_positive" CHECK ("quantity" > 0 AND "returnedQuantity" >= 0 AND "returnedQuantity" <= "quantity");
ALTER TABLE "Payment" ADD CONSTRAINT "payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "purchase_item_values" CHECK ("quantity" > 0 AND "unitCost" >= 0);
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "purchase_payment_positive" CHECK ("amount" > 0);
ALTER TABLE "Expense" ADD CONSTRAINT "expense_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Review" ADD CONSTRAINT "review_ratings_range" CHECK (
  "rating" BETWEEN 1 AND 5
  AND ("ratingWelcome" IS NULL OR "ratingWelcome" BETWEEN 1 AND 5)
  AND ("ratingValue" IS NULL OR "ratingValue" BETWEEN 1 AND 5)
);
ALTER TABLE "OpeningHour" ADD CONSTRAINT "opening_hour_day" CHECK ("dayOfWeek" BETWEEN 1 AND 7);
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "settings_singleton" CHECK ("id" = 1);

-- Une même configuration (couleur, RAM, stockage, état, option) n'existe qu'une fois par fiche.
CREATE UNIQUE INDEX "product_variant_unique" ON "Product" ("groupId", "color", "ramGb", "storageGb", "condition", "optionValue") NULLS NOT DISTINCT;
