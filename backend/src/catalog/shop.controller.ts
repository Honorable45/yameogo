import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PhoneCondition, Prisma, ProductKind } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Public } from '../auth/decorators';
import { paginate, PageQuery } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { availabilityOf, groupPublicInclude, presentGroupCard, presentGroupDetail, presentImage, publicVariantWhere, variantLabel } from './presenters';

const toBool = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';
const toList = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.split(',').map((v) => v.trim()).filter(Boolean).slice(0, 20) : value);

class CatalogQuery extends PageQuery {
  @IsOptional() @IsEnum(ProductKind) kind?: ProductKind;
  /** Slugs de marques séparés par des virgules. */
  @IsOptional() @Transform(toList) @IsArray() @IsString({ each: true }) brand?: string[];
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsEnum(PhoneCondition) condition?: PhoneCondition;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(64) ram?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(4096) storage?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Max(100_000_000) maxPrice?: number;
  @IsOptional() @Transform(toBool) @IsBoolean() promo?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() available?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() featured?: boolean;
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc']) order?: 'newest' | 'price_asc' | 'price_desc';
}

class CartLineDto {
  @IsString() variantId: string;
  @IsInt() @Min(1) @Max(50) quantity: number;
}

class CartCheckDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CartLineDto) items: CartLineDto[];
}

/**
 * Catalogue public : fiches actives et publiées, variantes actives et publiées.
 * Les prix et disponibilités viennent toujours de la base, jamais du navigateur.
 */
@Public()
@Controller('shop')
export class ShopController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private visible(kind?: ProductKind): Prisma.ProductGroupWhereInput {
    return { kind, status: 'ACTIVE', published: true, variants: { some: publicVariantWhere } };
  }

  @Get('catalog')
  async catalog(@Query() q: CatalogQuery) {
    // Filtres portant sur les variantes : une fiche est retenue si au moins une configuration y répond.
    const variant: Prisma.ProductWhereInput = { ...publicVariantWhere };
    if (q.condition) variant.condition = q.condition;
    if (q.ram) variant.ramGb = q.ram;
    if (q.storage) variant.storageGb = q.storage;
    if (q.minPrice !== undefined || q.maxPrice !== undefined) variant.salePrice = { gte: q.minPrice, lte: q.maxPrice };
    if (q.promo) variant.compareAtPrice = { not: null };

    const where: Prisma.ProductGroupWhereInput = { ...this.visible(q.kind), variants: { some: variant } };
    if (q.brand?.length) where.brand = { slug: { in: q.brand } };
    if (q.category) where.category = { slug: q.category };
    if (q.featured) where.featured = true;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { brand: { name: { contains: q.q, mode: 'insensitive' } } },
        { category: { name: { contains: q.q, mode: 'insensitive' } } },
        { compatibleWith: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    // Le catalogue d'une boutique tient en mémoire : tri sur le prix « à partir de » calculé.
    const rows = await this.prisma.productGroup.findMany({ where, include: groupPublicInclude, orderBy: { createdAt: 'desc' }, take: 500 });
    let cards = rows.map((g) => presentGroupCard(this.storage, g));
    if (q.available) cards = cards.filter((c) => c.inStock);
    const order = q.order ?? 'newest';
    cards.sort((a, b) => {
      // Les produits en stock passent devant les produits épuisés.
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      if (order === 'price_asc') return (a.priceFrom ?? 0) - (b.priceFrom ?? 0);
      if (order === 'price_desc') return (b.priceFrom ?? 0) - (a.priceFrom ?? 0);
      return Number(b.featured) - Number(a.featured) || b.createdAt.getTime() - a.createdAt.getTime();
    });
    const start = (q.page - 1) * q.pageSize;
    return paginate(cards.slice(start, start + q.pageSize), cards.length, q);
  }

  /** Valeurs proposées dans les filtres (seules celles réellement en vente). */
  @Get('catalog-facets')
  async facets(@Query('kind') kindRaw?: string) {
    const kind = kindRaw === 'PHONE' || kindRaw === 'ACCESSORY' ? kindRaw : undefined;
    const variants = await this.prisma.product.findMany({
      where: { ...publicVariantWhere, group: this.visible(kind) },
      select: { ramGb: true, storageGb: true, condition: true, salePrice: true, compareAtPrice: true, group: { select: { brand: { select: { name: true, slug: true } }, category: { select: { name: true, slug: true } } } } },
    });
    const brands = new Map<string, string>();
    const categories = new Map<string, string>();
    for (const v of variants) {
      if (v.group.brand) brands.set(v.group.brand.slug, v.group.brand.name);
      categories.set(v.group.category.slug, v.group.category.name);
    }
    const nums = (list: (number | null)[]) => [...new Set(list.filter((x): x is number => x !== null))].sort((a, b) => a - b);
    const prices = variants.map((v) => v.salePrice);
    return {
      brands: [...brands].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
      categories: [...categories].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
      rams: nums(variants.map((v) => v.ramGb)),
      storages: nums(variants.map((v) => v.storageGb)),
      conditions: [...new Set(variants.map((v) => v.condition).filter(Boolean))],
      price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
      hasPromotions: variants.some((v) => v.compareAtPrice !== null),
    };
  }

  @Get('catalog/:slug')
  async detail(@Param('slug') slug: string) {
    const group = await this.prisma.productGroup.findFirst({ where: { slug, ...this.visible() }, include: groupPublicInclude });
    if (!group) throw new NotFoundException('Produit introuvable.');
    return presentGroupDetail(this.storage, group);
  }

  /**
   * Panier : renvoie, pour chaque configuration, le prix et la disponibilité actuels.
   * Sert à afficher le panier et à construire le message WhatsApp avec des prix exacts.
   */
  @Post('cart/check')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async cartCheck(@Body() dto: CartCheckDto) {
    const ids = [...new Set(dto.items.map((i) => i.variantId))];
    const variants = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: { group: { include: { images: { orderBy: { position: 'asc' } }, brand: { select: { name: true } } } } },
    });
    return {
      lines: dto.items.map((item) => {
        const v = variants.find((x) => x.id === item.variantId);
        const sellable = v && v.status === 'ACTIVE' && v.published && v.group.status === 'ACTIVE' && v.group.published;
        if (!v || !sellable) return { variantId: item.variantId, available: false, issue: "Ce produit n'est plus proposé à la vente." };
        const { available } = availabilityOf(v);
        const image = v.group.images.find((i) => v.color && i.color === v.color) ?? v.group.images[0];
        return {
          variantId: v.id,
          available: available > 0,
          issue: available === 0 ? 'Épuisé' : available < item.quantity ? `Seulement ${available} disponible${available > 1 ? 's' : ''}` : null,
          maxQuantity: Math.min(available, 10),
          kind: v.kind,
          name: v.group.name,
          slug: v.group.slug,
          brand: v.group.brand?.name ?? null,
          label: variantLabel(v),
          sku: v.sku,
          color: v.color,
          ramGb: v.ramGb,
          storageGb: v.storageGb,
          condition: v.condition,
          optionName: v.group.optionName,
          optionValue: v.optionValue,
          unitPrice: v.salePrice,
          compareAtPrice: v.compareAtPrice,
          image: image ? presentImage(this.storage, image) : null,
        };
      }),
    };
  }
}
