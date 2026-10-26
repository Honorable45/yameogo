import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { slugify } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

class RepairTypeDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class UpdateRepairTypeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsInt() @Min(0) position?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class PriceDto {
  @IsString() phoneModelId: string;
  @IsString() repairTypeId: string;
  @IsInt() @Min(0) @Max(10_000_000) partsPrice: number;
  @IsInt() @Min(0) @Max(10_000_000) laborPrice: number;
  @IsOptional() @IsInt() @Min(5) @Max(60 * 24 * 30) durationMinutes?: number | null;
  @IsOptional() @IsString() @MaxLength(500) conditions?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export function presentPrice(p: { partsPrice: number; laborPrice: number; totalPrice: number; durationMinutes: number | null; conditions: string | null }) {
  return {
    partsPrice: p.partsPrice,
    laborPrice: p.laborPrice,
    totalPrice: p.totalPrice,
    durationMinutes: p.durationMinutes,
    conditions: p.conditions,
  };
}

/** Données publiques du parcours de devis : marques, modèles, pannes, tarifs configurés. */
@Public()
@Controller('repair-catalog')
export class PublicRepairCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async catalog() {
    const [brands, types] = await Promise.all([
      this.prisma.brand.findMany({
        where: { active: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          models: { where: { active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.repairType.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true, description: true } }),
    ]);
    return { brands, types };
  }

  /** Tarifs configurés pour un modèle (affichage des prix « à partir de » et de la grille). */
  @Get('models/:modelId/prices')
  async modelPrices(@Param('modelId') modelId: string) {
    const prices = await this.prisma.repairPrice.findMany({
      where: { phoneModelId: modelId, active: true, repairType: { active: true } },
      select: { repairTypeId: true, partsPrice: true, laborPrice: true, totalPrice: true, durationMinutes: true, conditions: true },
    });
    return prices;
  }

  /** Estimation : renvoie `null` si aucun tarif n'est configuré (jamais de prix inventé). */
  @Get('estimate')
  async estimate(@Query('modelId') modelId?: string, @Query('typeId') typeId?: string) {
    if (!modelId || !typeId) return { estimate: null };
    const price = await this.prisma.repairPrice.findUnique({
      where: { phoneModelId_repairTypeId: { phoneModelId: modelId, repairTypeId: typeId } },
      include: { repairType: true, phoneModel: true },
    });
    if (!price || !price.active || !price.repairType.active || !price.phoneModel.active) return { estimate: null };
    return { estimate: presentPrice(price) };
  }
}

@Controller('repair-pricing')
export class RepairPricingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('types')
  @RequirePermissions('repairs.read')
  types() {
    return this.prisma.repairType.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }], include: { _count: { select: { prices: true } } } });
  }

  @Post('types')
  @RequirePermissions('repairPricing.manage')
  async createType(@Body() dto: RepairTypeDto) {
    const slug = slugify(dto.name);
    if (!slug) throw new BadRequestException('Nom invalide.');
    if (await this.prisma.repairType.findFirst({ where: { OR: [{ slug }, { name: dto.name.trim() }] } })) throw new ConflictException('Ce type de panne existe déjà.');
    return this.prisma.repairType.create({ data: { name: dto.name.trim(), slug, description: dto.description?.trim() || null, position: dto.position ?? 0 } });
  }

  @Patch('types/:id')
  @RequirePermissions('repairPricing.manage')
  updateType(@Param('id') id: string, @Body() dto: UpdateRepairTypeDto) {
    return this.prisma.repairType.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
  }

  /** Grille de tarifs, éventuellement filtrée par marque. */
  @Get('prices')
  @RequirePermissions('repairs.read')
  prices(@Query('brandId') brandId?: string) {
    return this.prisma.repairPrice.findMany({
      where: brandId ? { phoneModel: { brandId } } : undefined,
      include: { phoneModel: { select: { id: true, name: true, brandId: true } }, repairType: { select: { id: true, name: true } } },
      orderBy: [{ phoneModel: { name: 'asc' } }, { repairType: { position: 'asc' } }],
    });
  }

  /** Création ou mise à jour du tarif d'un couple modèle / panne. Le total est toujours recalculé. */
  @Put('prices')
  @RequirePermissions('repairPricing.manage')
  async upsertPrice(@Body() dto: PriceDto, @CurrentUser() me: AuthUser) {
    const [model, type] = await Promise.all([
      this.prisma.phoneModel.findUnique({ where: { id: dto.phoneModelId } }),
      this.prisma.repairType.findUnique({ where: { id: dto.repairTypeId } }),
    ]);
    if (!model || !type) throw new NotFoundException('Modèle ou type de panne introuvable.');
    const data = {
      partsPrice: dto.partsPrice,
      laborPrice: dto.laborPrice,
      totalPrice: dto.partsPrice + dto.laborPrice,
      durationMinutes: dto.durationMinutes ?? null,
      conditions: dto.conditions?.trim() || null,
      active: dto.active ?? true,
    };
    const previous = await this.prisma.repairPrice.findUnique({ where: { phoneModelId_repairTypeId: { phoneModelId: model.id, repairTypeId: type.id } } });
    const price = await this.prisma.repairPrice.upsert({
      where: { phoneModelId_repairTypeId: { phoneModelId: model.id, repairTypeId: type.id } },
      update: data,
      create: { phoneModelId: model.id, repairTypeId: type.id, ...data },
    });
    await this.audit.log({
      userId: me.id,
      action: 'repairPrice.upsert',
      entity: 'RepairPrice',
      entityId: price.id,
      summary: `Tarif ${model.name} / ${type.name} : ${previous ? `${previous.totalPrice} → ` : ''}${price.totalPrice} XOF`,
    });
    return price;
  }

  @Delete('prices/:id')
  @HttpCode(204)
  @RequirePermissions('repairPricing.manage')
  async removePrice(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    // Les estimations déjà envoyées gardent leur copie figée : la suppression d'un tarif est sans effet sur elles.
    const price = await this.prisma.repairPrice.delete({ where: { id } });
    await this.audit.log({ userId: me.id, action: 'repairPrice.delete', entity: 'RepairPrice', entityId: id, summary: `Tarif supprimé (${price.totalPrice} XOF)` });
  }
}
