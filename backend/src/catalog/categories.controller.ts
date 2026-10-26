import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { slugify } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

class CategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsEnum(ProductKind)
  kind?: ProductKind;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('catalog.read')
  list(@Query('kind') kind?: ProductKind) {
    return this.prisma.category.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: 'asc' }, { position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  @Post()
  @RequirePermissions('catalog.write')
  async create(@Body() dto: CategoryDto, @CurrentUser() me: AuthUser) {
    const slug = slugify(dto.name);
    if (!slug) throw new BadRequestException('Nom de catégorie invalide.');
    if (await this.prisma.category.findUnique({ where: { slug } })) throw new ConflictException('Cette catégorie existe déjà.');
    const category = await this.prisma.category.create({
      data: { name: dto.name.trim(), slug, kind: dto.kind ?? 'ACCESSORY', description: dto.description, position: dto.position ?? 0 },
    });
    await this.audit.log({ userId: me.id, action: 'category.create', entity: 'Category', entityId: category.id, summary: `Catégorie créée : ${category.name}` });
    return category;
  }

  @Patch(':id')
  @RequirePermissions('catalog.write')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() me: AuthUser) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.name) {
      data.name = dto.name.trim();
      // Le slug (URL publique) reste stable pour ne pas casser les liens existants.
    }
    const category = await this.prisma.category.update({ where: { id }, data });
    await this.audit.log({ userId: me.id, action: 'category.update', entity: 'Category', entityId: id, summary: `Catégorie modifiée : ${category.name}` });
    return category;
  }
}
