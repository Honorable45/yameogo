import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Prisma, ProductKind, ProductStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { presentAdminProduct, productAdminInclude } from './presenters';

class ProductListQuery extends PageQuery {
  @IsOptional() @IsEnum(ProductKind) kind?: ProductKind;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() groupId?: string;
  @IsOptional() @IsIn(['low', 'out']) stock?: 'low' | 'out';
}

const SORTABLE = ['name', 'sku', 'salePrice', 'stockQuantity', 'createdAt', 'updatedAt'] as const;

/**
 * Articles vendables (= variantes des fiches produits), en lecture : caisse, approvisionnements, stocks, inventaire.
 * La création et la modification se font sur la fiche (/catalog-groups).
 */
@Controller('products')
export class ProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @RequirePermissions('catalog.read')
  async list(@Query() q: ProductListQuery, @CurrentUser() me: AuthUser) {
    const where: Prisma.ProductWhereInput = { kind: q.kind, status: q.status ?? 'ACTIVE', categoryId: q.categoryId, groupId: q.groupId };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { sku: { contains: q.q, mode: 'insensitive' } },
        { group: { brand: { name: { contains: q.q, mode: 'insensitive' } } } },
      ];
    }
    if (q.stock === 'out') where.stockQuantity = { lte: this.prisma.product.fields.reservedQuantity };
    if (q.stock === 'low') {
      // Disponible ≤ seuil : filtré en SQL brut pour comparer trois colonnes.
      const ids = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Product" WHERE "stockQuantity" - "reservedQuantity" <= "lowStockThreshold"`;
      where.id = { in: ids.map((r) => r.id) };
    }
    const sort = (SORTABLE as readonly string[]).includes(q.sort ?? '') ? q.sort! : 'name';
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({ where, include: productAdminInclude, orderBy: { [sort]: q.dir ?? (sort === 'name' ? 'asc' : 'desc') }, ...skipTake(q) }),
      this.prisma.product.count({ where }),
    ]);
    const withCosts = can(me.role, 'costs.read');
    return paginate(rows.map((p) => presentAdminProduct(this.storage, p, withCosts)), total, q);
  }

  @Get(':id')
  @RequirePermissions('catalog.read')
  async get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: productAdminInclude });
    if (!p) throw new NotFoundException('Article introuvable.');
    return presentAdminProduct(this.storage, p, can(me.role, 'costs.read'));
  }
}
