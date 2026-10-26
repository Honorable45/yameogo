-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'TECHNICIAN', 'SELLER');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('ACCESSORY', 'PART');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('INITIAL', 'PURCHASE', 'PURCHASE_CANCEL', 'SALE', 'SALE_RETURN', 'REPAIR_USE', 'REPAIR_RETURN', 'ADJUSTMENT', 'COUNT');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "UsedPhoneStatus" AS ENUM ('PENDING_CHECK', 'AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PhoneGrade" AS ENUM ('LIKE_NEW', 'VERY_GOOD', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "RepairRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('RECEIVED', 'DIAGNOSING', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'WAITING_PARTS', 'IN_PROGRESS', 'COMPLETED', 'PICKED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartSource" AS ENUM ('STOCK', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "PartStatus" AS ENUM ('USED', 'RETURNED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED', 'SUPERSEDED');

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
CREATE TYPE "ReviewService" AS ENUM ('REPAIR', 'ACCESSORY_PURCHASE', 'PHONE_PURCHASE', 'OTHER');

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
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "country" TEXT,
    "mapUrl" TEXT,
    "legalName" TEXT,
    "legalForm" TEXT,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "publicationDirector" TEXT,
    "hostingProvider" TEXT,
    "repairWarrantyText" TEXT,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "deliveryArea" TEXT,
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
CREATE TABLE "PhoneModel" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneModel_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'ACCESSORY',
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
    "productId" TEXT NOT NULL,
    "url" TEXT,
    "storageKey" TEXT,
    "alt" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCompatibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "phoneModelId" TEXT,

    CONSTRAINT "ProductCompatibility_pkey" PRIMARY KEY ("id")
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
    "repairPartId" TEXT,
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
CREATE TABLE "UsedPhone" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "phoneModelId" TEXT,
    "modelName" TEXT NOT NULL,
    "storageGb" INTEGER,
    "ramGb" INTEGER,
    "color" TEXT,
    "grade" "PhoneGrade" NOT NULL,
    "batteryHealth" INTEGER,
    "knownDefects" TEXT,
    "includedAccessories" TEXT,
    "description" TEXT,
    "purchasePrice" INTEGER NOT NULL,
    "salePrice" INTEGER NOT NULL,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "acquiredFrom" TEXT,
    "supplierId" TEXT,
    "imeiEncrypted" TEXT,
    "imeiHash" TEXT,
    "imeiLast4" TEXT,
    "status" "UsedPhoneStatus" NOT NULL DEFAULT 'PENDING_CHECK',
    "soldAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedPhoneImage" (
    "id" TEXT NOT NULL,
    "usedPhoneId" TEXT NOT NULL,
    "url" TEXT,
    "storageKey" TEXT,
    "alt" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "UsedPhoneImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedPhoneEvent" (
    "id" TEXT NOT NULL,
    "usedPhoneId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "UsedPhoneStatus",
    "toStatus" "UsedPhoneStatus",
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsedPhoneEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RepairType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairPrice" (
    "id" TEXT NOT NULL,
    "phoneModelId" TEXT NOT NULL,
    "repairTypeId" TEXT NOT NULL,
    "partsPrice" INTEGER NOT NULL,
    "laborPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "conditions" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "phoneModelId" TEXT,
    "modelName" TEXT NOT NULL,
    "repairTypeId" TEXT,
    "issueLabel" TEXT NOT NULL,
    "estimatedParts" INTEGER,
    "estimatedLabor" INTEGER,
    "estimatedTotal" INTEGER,
    "estimatedMinutes" INTEGER,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "customerId" TEXT,
    "description" TEXT,
    "photoKey" TEXT,
    "status" "RepairRequestStatus" NOT NULL DEFAULT 'NEW',
    "internalNote" TEXT,
    "repairJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairJob" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "phoneModelId" TEXT,
    "modelName" TEXT NOT NULL,
    "imeiEncrypted" TEXT,
    "imeiLast4" TEXT,
    "repairTypeId" TEXT,
    "reportedIssue" TEXT NOT NULL,
    "diagnosis" TEXT,
    "workDone" TEXT,
    "technicianId" TEXT,
    "status" "RepairStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "deviceReturnedAt" TIMESTAMP(3),
    "billedAmount" INTEGER NOT NULL DEFAULT 0,
    "consumablesCost" INTEGER NOT NULL DEFAULT 0,
    "otherDirectCosts" INTEGER NOT NULL DEFAULT 0,
    "otherCostsNote" TEXT,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "SettlementStatus" NOT NULL DEFAULT 'UNPAID',
    "internalNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepairJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairPart" (
    "id" TEXT NOT NULL,
    "repairJobId" TEXT NOT NULL,
    "source" "PartSource" NOT NULL,
    "productId" TEXT,
    "label" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "totalCost" INTEGER NOT NULL,
    "status" "PartStatus" NOT NULL DEFAULT 'USED',
    "returnedAt" TIMESTAMP(3),
    "returnNote" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairStatusHistory" (
    "id" TEXT NOT NULL,
    "repairJobId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "RepairStatus",
    "toStatus" "RepairStatus",
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairQuote" (
    "id" TEXT NOT NULL,
    "repairJobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "details" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedVia" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairQuote_pkey" PRIMARY KEY ("id")
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
    "productId" TEXT,
    "usedPhoneId" TEXT,
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
    "orderId" TEXT,
    "repairJobId" TEXT,
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
    "ratingRepair" INTEGER,
    "ratingWelcome" INTEGER,
    "ratingValue" INTEGER,
    "comment" TEXT,
    "displayName" TEXT,
    "serviceType" "ReviewService" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "repairJobId" TEXT,
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
    "repairJobId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
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
CREATE INDEX "PhoneModel_brandId_active_idx" ON "PhoneModel"("brandId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneModel_brandId_slug_key" ON "PhoneModel"("brandId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_kind_status_published_idx" ON "Product"("kind", "status", "published");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductCompatibility_brandId_idx" ON "ProductCompatibility"("brandId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_phoneModelId_idx" ON "ProductCompatibility"("phoneModelId");

-- CreateIndex
CREATE INDEX "ProductCompatibility_productId_idx" ON "ProductCompatibility"("productId");

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
CREATE UNIQUE INDEX "UsedPhone_reference_key" ON "UsedPhone"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "UsedPhone_slug_key" ON "UsedPhone"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UsedPhone_imeiHash_key" ON "UsedPhone"("imeiHash");

-- CreateIndex
CREATE INDEX "UsedPhone_status_idx" ON "UsedPhone"("status");

-- CreateIndex
CREATE INDEX "UsedPhone_brandId_idx" ON "UsedPhone"("brandId");

-- CreateIndex
CREATE INDEX "UsedPhoneImage_usedPhoneId_position_idx" ON "UsedPhoneImage"("usedPhoneId", "position");

-- CreateIndex
CREATE INDEX "UsedPhoneEvent_usedPhoneId_createdAt_idx" ON "UsedPhoneEvent"("usedPhoneId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairType_name_key" ON "RepairType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RepairType_slug_key" ON "RepairType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RepairPrice_phoneModelId_repairTypeId_key" ON "RepairPrice"("phoneModelId", "repairTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "RepairRequest_reference_key" ON "RepairRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "RepairRequest_repairJobId_key" ON "RepairRequest"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairRequest_status_createdAt_idx" ON "RepairRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairJob_number_key" ON "RepairJob"("number");

-- CreateIndex
CREATE INDEX "RepairJob_status_idx" ON "RepairJob"("status");

-- CreateIndex
CREATE INDEX "RepairJob_completedAt_idx" ON "RepairJob"("completedAt");

-- CreateIndex
CREATE INDEX "RepairJob_receivedAt_idx" ON "RepairJob"("receivedAt");

-- CreateIndex
CREATE INDEX "RepairJob_customerId_idx" ON "RepairJob"("customerId");

-- CreateIndex
CREATE INDEX "RepairPart_repairJobId_idx" ON "RepairPart"("repairJobId");

-- CreateIndex
CREATE INDEX "RepairStatusHistory_repairJobId_createdAt_idx" ON "RepairStatusHistory"("repairJobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepairQuote_repairJobId_version_key" ON "RepairQuote"("repairJobId", "version");

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
CREATE INDEX "OrderItem_usedPhoneId_idx" ON "OrderItem"("usedPhoneId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturn_createdAt_idx" ON "OrderReturn"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_confirmedAt_idx" ON "Payment"("status", "confirmedAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_repairJobId_idx" ON "Payment"("repairJobId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerReference_key" ON "Payment"("provider", "providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_replacesId_key" ON "Expense"("replacesId");

-- CreateIndex
CREATE INDEX "Expense_status_expenseDate_idx" ON "Expense"("status", "expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Review_repairJobId_key" ON "Review"("repairJobId");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVerificationToken_codeHash_key" ON "ReviewVerificationToken"("codeHash");

-- CreateIndex
CREATE INDEX "ReviewVerificationToken_repairJobId_idx" ON "ReviewVerificationToken"("repairJobId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneModel" ADD CONSTRAINT "PhoneModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCompatibility" ADD CONSTRAINT "ProductCompatibility_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "UsedPhone" ADD CONSTRAINT "UsedPhone_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedPhone" ADD CONSTRAINT "UsedPhone_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedPhone" ADD CONSTRAINT "UsedPhone_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedPhoneImage" ADD CONSTRAINT "UsedPhoneImage_usedPhoneId_fkey" FOREIGN KEY ("usedPhoneId") REFERENCES "UsedPhone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedPhoneEvent" ADD CONSTRAINT "UsedPhoneEvent_usedPhoneId_fkey" FOREIGN KEY ("usedPhoneId") REFERENCES "UsedPhone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedPhoneEvent" ADD CONSTRAINT "UsedPhoneEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPrice" ADD CONSTRAINT "RepairPrice_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPrice" ADD CONSTRAINT "RepairPrice_repairTypeId_fkey" FOREIGN KEY ("repairTypeId") REFERENCES "RepairType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRequest" ADD CONSTRAINT "RepairRequest_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRequest" ADD CONSTRAINT "RepairRequest_repairTypeId_fkey" FOREIGN KEY ("repairTypeId") REFERENCES "RepairType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRequest" ADD CONSTRAINT "RepairRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairRequest" ADD CONSTRAINT "RepairRequest_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_repairTypeId_fkey" FOREIGN KEY ("repairTypeId") REFERENCES "RepairType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairJob" ADD CONSTRAINT "RepairJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPart" ADD CONSTRAINT "RepairPart_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPart" ADD CONSTRAINT "RepairPart_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPart" ADD CONSTRAINT "RepairPart_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairStatusHistory" ADD CONSTRAINT "RepairStatusHistory_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairStatusHistory" ADD CONSTRAINT "RepairStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairQuote" ADD CONSTRAINT "RepairQuote_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairQuote" ADD CONSTRAINT "RepairQuote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_usedPhoneId_fkey" FOREIGN KEY ("usedPhoneId") REFERENCES "UsedPhone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVerificationToken" ADD CONSTRAINT "ReviewVerificationToken_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVerificationToken" ADD CONSTRAINT "ReviewVerificationToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────────────────── Contraintes métier (garde-fous au niveau de la base)
ALTER TABLE "Product" ADD CONSTRAINT "product_stock_non_negative" CHECK ("stockQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_reserved_non_negative" CHECK ("reservedQuantity" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "product_prices_non_negative" CHECK ("salePrice" >= 0 AND "averageCost" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "order_item_quantity_positive" CHECK ("quantity" > 0 AND "returnedQuantity" >= 0 AND "returnedQuantity" <= "quantity");
ALTER TABLE "OrderItem" ADD CONSTRAINT "order_item_target" CHECK (("productId" IS NULL) <> ("usedPhoneId" IS NULL));
ALTER TABLE "Payment" ADD CONSTRAINT "payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "payment_target" CHECK (("orderId" IS NULL) <> ("repairJobId" IS NULL));
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "purchase_item_values" CHECK ("quantity" > 0 AND "unitCost" >= 0);
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "purchase_payment_positive" CHECK ("amount" > 0);
ALTER TABLE "RepairPart" ADD CONSTRAINT "repair_part_values" CHECK ("quantity" > 0 AND "unitCost" >= 0);
ALTER TABLE "RepairJob" ADD CONSTRAINT "repair_amounts_non_negative" CHECK ("billedAmount" >= 0 AND "consumablesCost" >= 0 AND "otherDirectCosts" >= 0);
ALTER TABLE "Expense" ADD CONSTRAINT "expense_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "UsedPhone" ADD CONSTRAINT "used_phone_prices" CHECK ("purchasePrice" >= 0 AND "salePrice" >= 0);
ALTER TABLE "UsedPhone" ADD CONSTRAINT "used_phone_battery" CHECK ("batteryHealth" IS NULL OR ("batteryHealth" BETWEEN 0 AND 100));
ALTER TABLE "Review" ADD CONSTRAINT "review_ratings_range" CHECK (
  "rating" BETWEEN 1 AND 5
  AND ("ratingRepair" IS NULL OR "ratingRepair" BETWEEN 1 AND 5)
  AND ("ratingWelcome" IS NULL OR "ratingWelcome" BETWEEN 1 AND 5)
  AND ("ratingValue" IS NULL OR "ratingValue" BETWEEN 1 AND 5)
);
ALTER TABLE "OpeningHour" ADD CONSTRAINT "opening_hour_day" CHECK ("dayOfWeek" BETWEEN 1 AND 7);
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "settings_singleton" CHECK ("id" = 1);

-- Un même modèle ne peut figurer deux fois dans les compatibilités d'un produit,
-- et une compatibilité « marque entière » n'existe qu'une fois.
CREATE UNIQUE INDEX "product_compat_model_unique" ON "ProductCompatibility" ("productId", "phoneModelId") WHERE "phoneModelId" IS NOT NULL;
CREATE UNIQUE INDEX "product_compat_brand_unique" ON "ProductCompatibility" ("productId", "brandId") WHERE "phoneModelId" IS NULL;
