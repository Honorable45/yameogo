import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { slugify } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

class NameDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateNameDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Marques des smartphones (filtre du catalogue). */
@Controller('brands')
export class BrandsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('catalog.read')
  list() {
    return this.prisma.brand.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }], include: { _count: { select: { groups: true } } } });
  }

  @Post()
  @RequirePermissions('catalog.write')
  async create(@Body() dto: NameDto, @CurrentUser() me: AuthUser) {
    const slug = slugify(dto.name);
    if (!slug) throw new BadRequestException('Nom invalide.');
    if (await this.prisma.brand.findFirst({ where: { OR: [{ slug }, { name: dto.name.trim() }] } })) {
      throw new ConflictException('Cette marque existe déjà.');
    }
    const brand = await this.prisma.brand.create({ data: { name: dto.name.trim(), slug, position: dto.position ?? 0 } });
    await this.audit.log({ userId: me.id, action: 'brand.create', entity: 'Brand', entityId: brand.id, summary: `Marque créée : ${brand.name}` });
    return brand;
  }

  @Patch(':id')
  @RequirePermissions('catalog.write')
  update(@Param('id') id: string, @Body() dto: UpdateNameDto) {
    return this.prisma.brand.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
  }
}
