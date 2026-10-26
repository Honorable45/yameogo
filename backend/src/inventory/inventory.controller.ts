import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
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
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { AuditService } from '../common/audit.service';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from './stock.service';

class AdjustmentDto {
  @IsString()
  productId: string;

  @IsInt()
  @NotEquals(0, { message: 'La correction ne peut pas être nulle.' })
  @Min(-100_000)
  @Max(100_000)
  delta: number;

  @IsString()
  @MinLength(5, { message: 'Indiquez une justification (5 caractères minimum).' })
  @MaxLength(300)
  reason: string;
}

class CountLineDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(0)
  @Max(100_000)
  counted: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

class CountDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  lines: CountLineDto[];
}

class MovementQuery extends PageQuery {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsEnum(MovementType) type?: MovementType;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly audit: AuditService,
  ) {}

  /** Synthèse : valeur du stock (Responsable), articles à réapprovisionner, alertes. */
  @Get('summary')
  @RequirePermissions('stock.read')
  async summary(@CurrentUser() me: AuthUser) {
    const [value] = await this.prisma.$queryRaw<{ value: bigint | null; units: bigint | null }[]>`
      SELECT SUM("stockQuantity" * "averageCost") AS value, SUM("stockQuantity") AS units
      FROM "Product" WHERE "status" = 'ACTIVE'`;
    const [phones] = await this.prisma.$queryRaw<{ value: bigint | null; count: bigint }[]>`
      SELECT SUM("purchasePrice") AS value, COUNT(*) AS count
      FROM "UsedPhone" WHERE "status" IN ('PENDING_CHECK', 'AVAILABLE', 'RESERVED', 'RETURNED')`;
    const alerts = await this.alerts();
    const withCosts = can(me.role, 'costs.read');
    return {
      stockValue: withCosts ? Number(value.value ?? 0) : null,
      units: Number(value.units ?? 0),
      usedPhonesValue: withCosts ? Number(phones.value ?? 0) : null,
      usedPhonesInStock: Number(phones.count),
      alerts,
    };
  }

  @Get('alerts')
  @RequirePermissions('stock.read')
  async alerts() {
    const low = await this.prisma.$queryRaw<
      { id: string; name: string; sku: string; kind: string; available: number; threshold: number }[]
    >`
      SELECT "id", "name", "sku", "kind", ("stockQuantity" - "reservedQuantity")::int AS available, "lowStockThreshold" AS threshold
      FROM "Product"
      WHERE "status" = 'ACTIVE' AND "stockQuantity" - "reservedQuantity" <= "lowStockThreshold"
      ORDER BY ("stockQuantity" - "reservedQuantity") ASC, "name" ASC
      LIMIT 200`;
    const [pendingPurchases, discrepancies] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { status: 'DRAFT' },
        select: { id: true, number: true, purchaseDate: true, total: true, supplier: { select: { name: true } } },
        orderBy: { purchaseDate: 'asc' },
      }),
      this.prisma.inventoryCountLine.findMany({
        where: { difference: { not: 0 }, count: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } } },
        select: { id: true, expected: true, counted: true, difference: true, product: { select: { id: true, name: true, sku: true } }, count: { select: { id: true, createdAt: true } } },
        orderBy: { count: { createdAt: 'desc' } },
        take: 50,
      }),
    ]);
    return {
      outOfStock: low.filter((p) => p.available <= 0),
      lowStock: low.filter((p) => p.available > 0),
      pendingPurchases,
      discrepancies,
    };
  }

  @Get('movements')
  @RequirePermissions('stock.read')
  async movements(@Query() q: MovementQuery, @CurrentUser() me: AuthUser) {
    const where: Prisma.InventoryMovementWhereInput = {
      productId: q.productId,
      type: q.type,
      createdAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } : undefined,
    };
    if (q.q) where.product = { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { sku: { contains: q.q, mode: 'insensitive' } }] };
    const [rows, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true } }, user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    const withCosts = can(me.role, 'costs.read');
    return paginate(
      rows.map((m) => ({ ...m, unitCost: withCosts ? m.unitCost : null, averageCostAfter: withCosts ? m.averageCostAfter : null })),
      total,
      q,
    );
  }

  @Post('adjustments')
  @RequirePermissions('stock.adjust')
  async adjust(@Body() dto: AdjustmentDto, @CurrentUser() me: AuthUser) {
    await this.prisma.run(async (tx) => {
      await this.stock.adjust(tx, { productId: dto.productId, delta: dto.delta, type: 'ADJUSTMENT', reason: dto.reason.trim(), userId: me.id });
      await this.audit.log(
        { userId: me.id, action: 'stock.adjust', entity: 'Product', entityId: dto.productId, summary: `Correction de stock ${dto.delta > 0 ? '+' : ''}${dto.delta} : ${dto.reason}` },
        tx,
      );
    });
    return this.prisma.product.findUnique({ where: { id: dto.productId }, select: { id: true, stockQuantity: true, reservedQuantity: true } });
  }

  /**
   * Inventaire physique : la quantité attendue est lue au moment de la validation,
   * chaque écart génère un mouvement COUNT traçable.
   */
  @Post('counts')
  @RequirePermissions('stock.adjust')
  async count(@Body() dto: CountDto, @CurrentUser() me: AuthUser) {
    const ids = dto.lines.map((l) => l.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Un article apparaît plusieurs fois dans le comptage.');

    const countId = await this.prisma.run(async (tx) => {
      const count = await tx.inventoryCount.create({ data: { note: dto.note?.trim() || null, createdById: me.id } });
      for (const line of [...dto.lines].sort((a, b) => a.productId.localeCompare(b.productId))) {
        const product = await this.stock.lock(tx, line.productId);
        const difference = line.counted - product.stockQuantity;
        const row = await tx.inventoryCountLine.create({
          data: { countId: count.id, productId: line.productId, expected: product.stockQuantity, counted: line.counted, difference, note: line.note?.trim() || null },
        });
        if (difference !== 0) {
          await this.stock.adjust(tx, {
            productId: line.productId,
            delta: difference,
            type: 'COUNT',
            reason: `Inventaire du ${new Date().toLocaleDateString('fr-FR')}${line.note ? ` — ${line.note}` : ''}`,
            userId: me.id,
            countLineId: row.id,
          });
        }
      }
      await this.audit.log({ userId: me.id, action: 'stock.count', entity: 'InventoryCount', entityId: count.id, summary: `Inventaire enregistré (${dto.lines.length} article(s))` }, tx);
      return count.id;
    });
    return this.getCount(countId);
  }

  @Get('counts')
  @RequirePermissions('stock.read')
  counts() {
    return this.prisma.inventoryCount.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { name: true } }, _count: { select: { lines: true } }, lines: { where: { difference: { not: 0 } }, select: { id: true } } },
    });
  }

  @Get('counts/:id')
  @RequirePermissions('stock.read')
  async getCount(@Param('id') id: string) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true } }, lines: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });
    if (!count) throw new NotFoundException('Inventaire introuvable.');
    return count;
  }
}
