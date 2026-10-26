import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhoneCondition, Prisma, ProductKind, ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_UPLOAD_BYTES, StorageService } from '../storage/storage.service';
import { GroupsService } from './groups.service';
import { availabilityOf, presentImage } from './presenters';

const MAX_PRICE = 50_000_000;
const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

class SpecDto {
  @IsString() @MaxLength(60) label: string;
  @IsString() @MaxLength(200) value: string;
}

class VariantDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(40) color?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(7) colorHex?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(1) @Max(64) ramGb?: number | null;
  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(1) @Max(4096) storageGb?: number | null;
  @IsOptional() @Transform(emptyToNull) @IsEnum(PhoneCondition) condition?: PhoneCondition | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) optionValue?: string | null;
  @IsInt({ message: 'Le prix doit être un nombre entier en FCFA.' }) @Min(0) @Max(MAX_PRICE) salePrice: number;
  @IsOptional() @Transform(emptyToNull) @IsInt() @Min(0) @Max(MAX_PRICE) compareAtPrice?: number | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(40) sku?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) lowStockThreshold?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) stock?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_PRICE) unitCost?: number;
}

class GroupDto {
  @IsEnum(ProductKind) kind: ProductKind;
  @IsString() @MinLength(2) @MaxLength(140) name: string;
  @IsOptional() @Transform(emptyToNull) @IsString() brandId?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(60) brandName?: string | null;
  @IsString() categoryId: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => SpecDto) specs?: SpecDto[];
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(40) optionName?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300) compatibleWith?: string | null;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @Transform(emptyToNull) @IsString() supplierId?: string | null;
  @IsArray() @ArrayMinSize(1, { message: 'Ajoutez au moins une configuration.' }) @ArrayMaxSize(120) @ValidateNested({ each: true }) @Type(() => VariantDto) variants: VariantDto[];
}

class GroupListQuery extends PageQuery {
  @IsOptional() @IsEnum(ProductKind) kind?: ProductKind;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsString() brandId?: string;
}

class ImageDto {
  @IsOptional() @IsString() @MaxLength(160) alt?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(40) color?: string | null;
}

class ReorderDto {
  @IsArray() @IsString({ each: true }) ids: string[];
}

/** Fiches produits (smartphones et accessoires) avec leurs configurations, prix, stocks et photos. */
@Controller('catalog-groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @RequirePermissions('catalog.read')
  async list(@Query() q: GroupListQuery) {
    const where: Prisma.ProductGroupWhereInput = { kind: q.kind, status: q.status ?? 'ACTIVE', brandId: q.brandId };
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { brand: { name: { contains: q.q, mode: 'insensitive' } } },
        { variants: { some: { sku: { contains: q.q, mode: 'insensitive' } } } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.productGroup.findMany({
        where,
        orderBy: q.sort === 'name' ? { name: 'asc' } : { updatedAt: 'desc' },
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          images: { orderBy: { position: 'asc' }, take: 1 },
          variants: { where: { status: 'ACTIVE' }, select: { salePrice: true, compareAtPrice: true, stockQuantity: true, reservedQuantity: true, lowStockThreshold: true } },
        },
        ...skipTake(q),
      }),
      this.prisma.productGroup.count({ where }),
    ]);
    return paginate(
      rows.map((g) => {
        const prices = g.variants.map((v) => v.salePrice);
        return {
          id: g.id,
          kind: g.kind,
          name: g.name,
          slug: g.slug,
          brand: g.brand,
          category: g.category,
          published: g.published,
          featured: g.featured,
          status: g.status,
          isDemo: g.isDemo,
          image: g.images[0] ? presentImage(this.storage, g.images[0]) : null,
          variantCount: g.variants.length,
          stock: g.variants.reduce((a, v) => a + v.stockQuantity, 0),
          outOfStock: g.variants.filter((v) => availabilityOf(v).availability === 'OUT_OF_STOCK').length,
          priceFrom: prices.length ? Math.min(...prices) : null,
          priceTo: prices.length ? Math.max(...prices) : null,
          onSale: g.variants.some((v) => v.compareAtPrice !== null),
          updatedAt: g.updatedAt,
        };
      }),
      total,
      q,
    );
  }

  @Get(':id')
  @RequirePermissions('catalog.read')
  get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.groups.get(id, can(me.role, 'costs.read'));
  }

  @Post()
  @RequirePermissions('catalog.write')
  create(@Body() dto: GroupDto, @CurrentUser() me: AuthUser) {
    return this.groups.create(dto, me.id, can(me.role, 'costs.read'));
  }

  @Put(':id')
  @RequirePermissions('catalog.write')
  update(@Param('id') id: string, @Body() dto: GroupDto, @CurrentUser() me: AuthUser) {
    return this.groups.update(id, dto, me.id, can(me.role, 'costs.read'));
  }

  @Post(':id/archive')
  @HttpCode(200)
  @RequirePermissions('catalog.write')
  archive(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.groups.setStatus(id, 'ARCHIVED', me.id, can(me.role, 'costs.read'));
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions('catalog.write')
  restore(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.groups.setStatus(id, 'ACTIVE', me.id, can(me.role, 'costs.read'));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('catalog.write')
  remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.groups.remove(id, me.id);
  }

  @Post(':id/images')
  @RequirePermissions('catalog.write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  addImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() body: ImageDto) {
    return this.groups.addImage(id, file?.buffer, body.alt, body.color ?? undefined);
  }

  @Patch(':id/images/order')
  @RequirePermissions('catalog.write')
  reorder(@Param('id') id: string, @Body() dto: ReorderDto) {
    return this.groups.reorderImages(id, dto.ids);
  }

  @Patch(':id/images/:imageId')
  @RequirePermissions('catalog.write')
  updateImage(@Param('id') id: string, @Param('imageId') imageId: string, @Body() dto: ImageDto) {
    return this.groups.updateImage(id, imageId, dto);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(204)
  @RequirePermissions('catalog.write')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.groups.removeImage(id, imageId);
  }
}
