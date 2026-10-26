import { Body, Controller, Get, HttpCode, Module, Param, Post, Put, Query } from '@nestjs/common';
import { PaymentMethod, Prisma, PurchaseStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaService } from '../prisma/prisma.service';
import { PurchasesService } from './purchases.service';

class PurchaseItemDto {
  @IsString() productId: string;
  @IsInt() @Min(1) @Max(100_000) quantity: number;
  @IsInt() @Min(0) @Max(50_000_000) unitCost: number;
}

class PurchaseDto {
  @IsString() supplierId: string;
  @IsOptional() @IsString() @MaxLength(60) invoiceNumber?: string;
  @IsDateString({}, { message: 'Date invalide.' }) purchaseDate: string;
  @IsInt() @Min(0) @Max(100_000_000) extraCosts: number;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Ajoutez au moins un article.' })
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}

class ReasonDto {
  @IsString() @MinLength(5, { message: 'Indiquez un motif (5 caractères minimum).' }) @MaxLength(300) reason: string;
}

class PurchasePaymentDto {
  @IsInt() @Min(1) @Max(100_000_000) amount: number;
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsDateString() paidAt: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class PurchaseQuery extends PageQuery {
  @IsOptional() @IsEnum(PurchaseStatus) status?: PurchaseStatus;
  @IsOptional() @IsString() supplierId?: string;
}

@Controller('purchases')
@RequirePermissions('purchases.manage')
export class PurchasesController {
  constructor(
    private readonly purchases: PurchasesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Query() q: PurchaseQuery) {
    const where: Prisma.PurchaseWhereInput = { status: q.status, supplierId: q.supplierId };
    if (q.q) {
      where.OR = [
        { number: { contains: q.q, mode: 'insensitive' } },
        { invoiceNumber: { contains: q.q, mode: 'insensitive' } },
        { supplier: { name: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: [{ purchaseDate: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(q),
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return paginate(rows, total, q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.purchases.get(id);
  }

  @Post()
  create(@Body() dto: PurchaseDto, @CurrentUser() me: AuthUser) {
    return this.purchases.create(dto, me.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: PurchaseDto, @CurrentUser() me: AuthUser) {
    return this.purchases.update(id, dto, me.id);
  }

  @Post(':id/validate')
  @HttpCode(200)
  validate(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.purchases.validate(id, me.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() me: AuthUser) {
    return this.purchases.cancel(id, dto.reason.trim(), me.id);
  }

  @Post(':id/payments')
  addPayment(@Param('id') id: string, @Body() dto: PurchasePaymentDto, @CurrentUser() me: AuthUser) {
    return this.purchases.addPayment(id, dto, me.id);
  }

  @Post(':id/payments/:paymentId/cancel')
  @HttpCode(200)
  cancelPayment(@Param('id') id: string, @Param('paymentId') paymentId: string, @Body() dto: ReasonDto, @CurrentUser() me: AuthUser) {
    return this.purchases.cancelPayment(id, paymentId, dto.reason.trim(), me.id);
  }
}

@Module({ imports: [InventoryModule], controllers: [PurchasesController], providers: [PurchasesService], exports: [PurchasesService] })
export class PurchasesModule {}
