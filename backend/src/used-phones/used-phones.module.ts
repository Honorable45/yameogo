import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhoneCondition, PhoneGrade, Prisma, UsedPhoneStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_UPLOAD_BYTES } from '../storage/storage.service';
import { UsedPhonesService } from './used-phones.service';

class UsedPhoneDto {
  @IsString() brandId: string;
  @IsOptional() @IsString() phoneModelId?: string | null;
  @IsString() @MinLength(1) @MaxLength(80) modelName: string;
  @IsOptional() @IsEnum(PhoneCondition) condition?: PhoneCondition;
  @IsOptional() @IsInt() @Min(1) @Max(4096) storageGb?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(64) ramGb?: number | null;
  @IsOptional() @IsString() @MaxLength(40) color?: string | null;
  @IsEnum(PhoneGrade) grade: PhoneGrade;
  @IsOptional() @IsInt() @Min(0) @Max(100) batteryHealth?: number | null;
  @IsOptional() @IsString() @MaxLength(1000) knownDefects?: string | null;
  @IsOptional() @IsString() @MaxLength(500) includedAccessories?: string | null;
  @IsOptional() @IsString() @MaxLength(3000) description?: string | null;
  @IsInt() @Min(0) @Max(50_000_000) purchasePrice: number;
  @IsInt() @Min(0) @Max(50_000_000) salePrice: number;
  @IsOptional() @IsInt() @Min(0) @Max(36) warrantyMonths?: number;
  @IsDateString() acquiredAt: string;
  @IsOptional() @IsString() @MaxLength(160) acquiredFrom?: string | null;
  @IsOptional() @IsString() supplierId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) imei?: string | null;
  @IsOptional() @IsBoolean() confirmDuplicate?: boolean;
}

class UpdateUsedPhoneDto {
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() phoneModelId?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) modelName?: string;
  @IsOptional() @IsEnum(PhoneCondition) condition?: PhoneCondition;
  @IsOptional() @IsInt() @Min(1) @Max(4096) storageGb?: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(64) ramGb?: number | null;
  @IsOptional() @IsString() @MaxLength(40) color?: string | null;
  @IsOptional() @IsEnum(PhoneGrade) grade?: PhoneGrade;
  @IsOptional() @IsInt() @Min(0) @Max(100) batteryHealth?: number | null;
  @IsOptional() @IsString() @MaxLength(1000) knownDefects?: string | null;
  @IsOptional() @IsString() @MaxLength(500) includedAccessories?: string | null;
  @IsOptional() @IsString() @MaxLength(3000) description?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(50_000_000) purchasePrice?: number;
  @IsOptional() @IsInt() @Min(0) @Max(50_000_000) salePrice?: number;
  @IsOptional() @IsInt() @Min(0) @Max(36) warrantyMonths?: number;
  @IsOptional() @IsDateString() acquiredAt?: string;
  @IsOptional() @IsString() @MaxLength(160) acquiredFrom?: string | null;
  @IsOptional() @IsString() supplierId?: string | null;
  @IsOptional() @IsString() @MaxLength(30) imei?: string | null;
}

class StatusDto {
  @IsEnum(UsedPhoneStatus) status: UsedPhoneStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class AdminQuery extends PageQuery {
  @IsOptional() @IsEnum(UsedPhoneStatus) status?: UsedPhoneStatus;
  @IsOptional() @IsEnum(PhoneCondition) condition?: PhoneCondition;
  @IsOptional() @IsString() brandId?: string;
}

class PublicQuery {
  @IsOptional() @IsString() @MaxLength(60) brand?: string;
  @IsOptional() @IsEnum(PhoneCondition) condition?: PhoneCondition;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minStorage?: number;
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc']) order?: string;
}

class AltDto {
  @IsOptional() @IsString() @MaxLength(160) alt?: string;
}

@Public()
@Controller('shop/phones')
export class PublicPhonesController {
  constructor(private readonly phones: UsedPhonesService) {}

  @Get()
  list(@Query() q: PublicQuery) {
    return this.phones.publicList(q);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.phones.publicDetail(slug);
  }
}

@Controller('used-phones')
export class UsedPhonesController {
  constructor(
    private readonly phones: UsedPhonesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions('usedPhones.read')
  async list(@Query() q: AdminQuery, @CurrentUser() me: AuthUser) {
    const where: Prisma.UsedPhoneWhereInput = { status: q.status, brandId: q.brandId, condition: q.condition };
    if (!q.status) where.status = { not: 'ARCHIVED' };
    if (q.q) {
      const digits = q.q.replace(/\D/g, '');
      where.OR = [
        { reference: { contains: q.q, mode: 'insensitive' } },
        { modelName: { contains: q.q, mode: 'insensitive' } },
        ...(digits.length === 4 ? [{ imeiLast4: digits }] : []),
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.usedPhone.findMany({
        where,
        include: { brand: { select: { id: true, name: true, slug: true } }, phoneModel: { select: { id: true, name: true } }, images: { orderBy: { position: 'asc' }, take: 1 }, supplier: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.usedPhone.count({ where }),
    ]);
    const withCosts = can(me.role, 'costs.read');
    return paginate(rows.map((p) => this.phones.presentAdmin(p, withCosts)), total, q);
  }

  @Get(':id')
  @RequirePermissions('usedPhones.read')
  async get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const withCosts = can(me.role, 'costs.read');
    const [phone, events, sales] = await Promise.all([
      this.phones.getRow(id),
      this.prisma.usedPhoneEvent.findMany({ where: { usedPhoneId: id }, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } }),
      this.prisma.orderItem.findMany({
        where: { usedPhoneId: id },
        select: { id: true, unitPrice: true, unitCost: true, returnedQuantity: true, order: { select: { id: true, number: true, status: true, completedAt: true, createdAt: true } } },
        orderBy: { order: { createdAt: 'desc' } },
      }),
    ]);
    return {
      ...this.phones.presentAdmin(phone, withCosts),
      events,
      sales: sales.map((s) => ({
        ...s,
        unitCost: withCosts ? s.unitCost : null,
        grossMargin: withCosts && s.unitCost !== null ? s.unitPrice - s.unitCost : null,
      })),
    };
  }

  @Post()
  @RequirePermissions('usedPhones.write')
  async create(@Body() dto: UsedPhoneDto, @CurrentUser() me: AuthUser) {
    return this.phones.presentAdmin(await this.phones.create(dto, me.id), true);
  }

  @Patch(':id')
  @RequirePermissions('usedPhones.write')
  async update(@Param('id') id: string, @Body() dto: UpdateUsedPhoneDto, @CurrentUser() me: AuthUser) {
    return this.phones.presentAdmin(await this.phones.update(id, dto, me.id), true);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermissions('usedPhones.write')
  async status(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser() me: AuthUser) {
    return this.phones.presentAdmin(await this.phones.changeStatus(id, dto.status, dto.note, me.id), true);
  }

  @Post(':id/imei')
  @HttpCode(200)
  @RequirePermissions('usedPhones.imei')
  imei(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.phones.revealImei(id, me.id);
  }

  @Post(':id/images')
  @RequirePermissions('usedPhones.write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  addImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() body: AltDto) {
    return this.phones.addImage(id, file?.buffer, body.alt);
  }

  @Delete(':id/images/:imageId')
  @HttpCode(204)
  @RequirePermissions('usedPhones.write')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.phones.removeImage(id, imageId);
  }
}

@Module({ controllers: [PublicPhonesController, UsedPhonesController], providers: [UsedPhonesService], exports: [UsedPhonesService] })
export class UsedPhonesModule {}
