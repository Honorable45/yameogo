import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Public } from '../auth/decorators';
import { paginate, PageQuery, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { presentPublicProduct, productPublicInclude } from './presenters';

class ShopQuery extends PageQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(100_000_000)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  order?: 'newest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  available?: boolean;
}

/** Catalogue public : accessoires actifs et publiés uniquement. */
@Public()
@Controller('shop')
export class ShopController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private visible(): Prisma.ProductWhereInput {
    return { kind: 'ACCESSORY', status: 'ACTIVE', published: true };
  }

  @Get('categories')
  async categories() {
    const categories = await this.prisma.category.findMany({
      where: { kind: 'ACCESSORY', active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: { select: { products: { where: this.visible() } } },
        // Photo représentative : celle de l'article publié le plus récent de la catégorie.
        products: { where: { ...this.visible(), images: { some: {} } }, orderBy: { createdAt: 'desc' }, take: 1, select: { images: { orderBy: { position: 'asc' }, take: 1 } } },
      },
    });
    return categories.map(({ _count, products, ...c }) => {
      const img = products[0]?.images[0];
      return { ...c, productCount: _count.products, imageUrl: img ? (img.url ?? this.storage.publicUrl(img.storageKey)) : null };
    });
  }

  @Get('brands')
  brands() {
    return this.prisma.brand.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        models: { where: { active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true } },
      },
    });
  }

  @Get('products')
  async products(@Query() q: ShopQuery) {
    const where: Prisma.ProductWhereInput = { ...this.visible() };
    const and: Prisma.ProductWhereInput[] = [];
    if (q.category) where.category = { slug: q.category, active: true };
    if (q.q) {
      and.push({
        OR: [
          { name: { contains: q.q, mode: 'insensitive' } },
          { description: { contains: q.q, mode: 'insensitive' } },
          { sku: { equals: q.q.toUpperCase() } },
        ],
      });
    }
    if (q.minPrice !== undefined || q.maxPrice !== undefined) where.salePrice = { gte: q.minPrice, lte: q.maxPrice };
    if (q.model) {
      const model = await this.prisma.phoneModel.findUnique({ where: { id: q.model } });
      and.push({
        compatibility: { some: { OR: [{ phoneModelId: q.model }, ...(model ? [{ brandId: model.brandId, phoneModelId: null }] : [])] } },
      });
    } else if (q.brand) {
      and.push({ compatibility: { some: { brand: { slug: q.brand } } } });
    }
    if (q.available) where.stockQuantity = { gt: this.prisma.product.fields.reservedQuantity };
    if (and.length) where.AND = and;

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      q.order === 'price_asc' ? { salePrice: 'asc' } : q.order === 'price_desc' ? { salePrice: 'desc' } : { createdAt: 'desc' };

    const pageQuery = Object.assign(new PageQuery(), q, { pageSize: Math.min(q.pageSize ?? 24, 48) });
    const [rows, total, bounds] = await Promise.all([
      this.prisma.product.findMany({ where, include: productPublicInclude, orderBy: [orderBy, { id: 'asc' }], ...skipTake(pageQuery) }),
      this.prisma.product.count({ where }),
      this.prisma.product.aggregate({ where: this.visible(), _min: { salePrice: true }, _max: { salePrice: true } }),
    ]);
    return {
      ...paginate(
        rows.map((p) => presentPublicProduct(this.storage, p)),
        total,
        pageQuery,
      ),
      priceRange: { min: bounds._min.salePrice ?? 0, max: bounds._max.salePrice ?? 0 },
    };
  }

  @Get('products/:slug')
  async product(@Param('slug') slug: string) {
    const product = await this.prisma.product.findFirst({ where: { slug, ...this.visible() }, include: productPublicInclude });
    if (!product) throw new NotFoundException('Article introuvable.');

    // Suggestions : même catégorie, disponibles.
    const related = await this.prisma.product.findMany({
      where: { ...this.visible(), categoryId: product.categoryId, id: { not: product.id }, stockQuantity: { gt: this.prisma.product.fields.reservedQuantity } },
      include: productPublicInclude,
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
    return {
      product: presentPublicProduct(this.storage, product),
      related: related.map((p) => presentPublicProduct(this.storage, p)),
    };
  }

  /** Sélection pour l'accueil : articles disponibles, les plus récents. */
  @Get('featured')
  async featured() {
    const rows = await this.prisma.product.findMany({
      where: { ...this.visible(), stockQuantity: { gt: this.prisma.product.fields.reservedQuantity }, images: { some: {} } },
      include: productPublicInclude,
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    return rows.map((p) => presentPublicProduct(this.storage, p));
  }
}
