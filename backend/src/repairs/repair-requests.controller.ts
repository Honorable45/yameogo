import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Prisma, RepairRequestStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { nextYearlyNumber } from '../common/counters';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { isValidPhone, normalizePhone } from '../common/text';
import { CustomersService } from '../customers/customers.module';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_UPLOAD_BYTES, StorageService } from '../storage/storage.service';
import { RepairsService } from './repairs.service';

class RequestDto {
  @IsString() @MinLength(1) @MaxLength(60) brandName: string;
  @IsOptional() @IsString() phoneModelId?: string;
  @IsString() @MinLength(1, { message: 'Indiquez le modèle.' }) @MaxLength(80) modelName: string;
  @IsOptional() @IsString() repairTypeId?: string;
  @IsString() @MinLength(2) @MaxLength(120) issueLabel: string;
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsString() @MinLength(8, { message: 'Numéro de téléphone invalide.' }) @MaxLength(30) customerPhone: string;
  @IsOptional() @IsString() @MaxLength(1500) description?: string;
}

class UpdateRequestDto {
  @IsOptional() @IsEnum(RepairRequestStatus) status?: RepairRequestStatus;
  @IsOptional() @IsString() @MaxLength(1000) internalNote?: string;
}

class ConvertDto {
  @IsOptional() @IsString() technicianId?: string;
  @IsOptional() @IsString() @MaxLength(30) imei?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}

class RequestQuery extends PageQuery {
  @IsOptional() @IsEnum(RepairRequestStatus) status?: RepairRequestStatus;
}

@Controller('repair-requests')
export class RepairRequestsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly repairs: RepairsService,
    private readonly customers: CustomersService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Demande de devis en ligne. L'estimation est recalculée ici à partir des tarifs configurés
   * et enregistrée telle qu'elle a été présentée au client.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post()
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async submit(@Body() dto: RequestDto, @UploadedFile() photo?: Express.Multer.File) {
    if (!isValidPhone(dto.customerPhone)) throw new BadRequestException('Numéro de téléphone invalide.');

    let modelId: string | null = null;
    let typeId: string | null = null;
    if (dto.phoneModelId) {
      const model = await this.prisma.phoneModel.findUnique({ where: { id: dto.phoneModelId }, include: { brand: true } });
      if (model) modelId = model.id;
    }
    if (dto.repairTypeId) {
      const type = await this.prisma.repairType.findUnique({ where: { id: dto.repairTypeId } });
      if (type) typeId = type.id;
    }
    const price =
      modelId && typeId
        ? await this.prisma.repairPrice.findFirst({ where: { phoneModelId: modelId, repairTypeId: typeId, active: true } })
        : null;
    const photoKey = photo?.buffer?.length ? await this.storage.savePrivateFile(photo.buffer, 'requests') : null;

    const request = await this.prisma.run(async (tx) =>
      tx.repairRequest.create({
        data: {
          reference: await nextYearlyNumber(tx, 'D'),
          brandName: dto.brandName.trim(),
          phoneModelId: modelId,
          modelName: dto.modelName.trim(),
          repairTypeId: typeId,
          issueLabel: dto.issueLabel.trim(),
          estimatedParts: price?.partsPrice ?? null,
          estimatedLabor: price?.laborPrice ?? null,
          estimatedTotal: price?.totalPrice ?? null,
          estimatedMinutes: price?.durationMinutes ?? null,
          customerName: dto.customerName?.trim() || null,
          customerPhone: normalizePhone(dto.customerPhone),
          description: dto.description?.trim() || null,
          photoKey,
        },
      }),
    );
    return {
      reference: request.reference,
      estimatedTotal: request.estimatedTotal,
      estimatedMinutes: request.estimatedMinutes,
      createdAt: request.createdAt,
    };
  }

  @Get()
  @RequirePermissions('requests.manage')
  async list(@Query() q: RequestQuery) {
    const where: Prisma.RepairRequestWhereInput = { status: q.status };
    if (q.q) {
      const digits = q.q.replace(/\D/g, '');
      where.OR = [
        { reference: { contains: q.q, mode: 'insensitive' } },
        { modelName: { contains: q.q, mode: 'insensitive' } },
        { customerName: { contains: q.q, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ customerPhone: { contains: digits } }] : []),
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.repairRequest.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q), include: { repairJob: { select: { id: true, number: true } } } }),
      this.prisma.repairRequest.count({ where }),
    ]);
    return paginate(rows.map((r) => this.present(r)), total, q);
  }

  private present<T extends { photoKey: string | null }>(r: T) {
    const { photoKey, ...rest } = r;
    return { ...rest, photoUrl: photoKey ? `/api/files/${photoKey}` : null };
  }

  @Get(':id')
  @RequirePermissions('requests.manage')
  async get(@Param('id') id: string) {
    const request = await this.prisma.repairRequest.findUnique({
      where: { id },
      include: { repairJob: { select: { id: true, number: true, status: true } }, phoneModel: { select: { id: true, name: true, brandId: true } }, repairType: { select: { id: true, name: true } } },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    const customer = await this.prisma.customer.findUnique({ where: { phone: request.customerPhone }, select: { id: true, name: true } });
    return { ...this.present(request), knownCustomer: customer };
  }

  @Patch(':id')
  @RequirePermissions('requests.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateRequestDto) {
    if (dto.status === 'CONVERTED') throw new BadRequestException('Utilisez « Prendre en charge » pour créer le dossier de réparation.');
    return this.present(await this.prisma.repairRequest.update({ where: { id }, data: { status: dto.status, internalNote: dto.internalNote?.trim() } }));
  }

  /** Prise en charge en boutique : crée le dossier de réparation à partir de la demande. */
  @Post(':id/convert')
  @RequirePermissions('repairs.write')
  async convert(@Param('id') id: string, @Body() dto: ConvertDto, @CurrentUser() me: AuthUser) {
    const request = await this.prisma.repairRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Demande introuvable.');
    const job = await this.repairs.create(
      {
        customerName: request.customerName ?? undefined,
        customerPhone: request.customerPhone,
        brandName: request.brandName,
        phoneModelId: request.phoneModelId,
        modelName: request.modelName,
        repairTypeId: request.repairTypeId,
        reportedIssue: [request.issueLabel, request.description].filter(Boolean).join(' — '),
        technicianId: dto.technicianId ?? null,
        imei: dto.imei ?? null,
        dueAt: dto.dueAt ?? null,
        requestId: request.id,
      },
      me.id,
    );
    return { id: job.id, number: job.number };
  }
}
