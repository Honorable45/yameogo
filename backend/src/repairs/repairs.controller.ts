import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { PaymentKind, PaymentMethod, Prisma, RepairStatus, SettlementStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { loadConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { allowedRepairTransitions, REPAIR_STATUS_LABELS } from './repair-rules';
import { RepairDetail, RepairsService } from './repairs.service';

const MAX = 50_000_000;

class CreateRepairDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(30) customerPhone?: string;
  @IsString() @MinLength(1) @MaxLength(60) brandName: string;
  @IsOptional() @IsString() phoneModelId?: string | null;
  @IsString() @MinLength(1) @MaxLength(80) modelName: string;
  @IsOptional() @IsString() @MaxLength(30) imei?: string | null;
  @IsOptional() @IsString() repairTypeId?: string | null;
  @IsString() @MinLength(3, { message: 'Décrivez la panne signalée.' }) @MaxLength(2000) reportedIssue: string;
  @IsOptional() @IsString() technicianId?: string | null;
  @IsOptional() @IsDateString() dueAt?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(MAX) billedAmount?: number;
  @IsOptional() @IsString() @MaxLength(2000) internalNotes?: string | null;
  @IsOptional() @IsString() requestId?: string;
}

class UpdateRepairDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) brandName?: string;
  @IsOptional() @IsString() phoneModelId?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) modelName?: string;
  @IsOptional() @IsString() @MaxLength(30) imei?: string | null;
  @IsOptional() @IsString() repairTypeId?: string | null;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(2000) reportedIssue?: string;
  @IsOptional() @IsString() @MaxLength(4000) diagnosis?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) workDone?: string | null;
  @IsOptional() @IsString() technicianId?: string | null;
  @IsOptional() @IsDateString() dueAt?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(MAX) billedAmount?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX) consumablesCost?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX) otherDirectCosts?: number;
  @IsOptional() @IsString() @MaxLength(300) otherCostsNote?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) internalNotes?: string | null;
}

class StatusDto {
  @IsEnum(RepairStatus) status: RepairStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class QuoteDto {
  @IsInt() @Min(0) @Max(MAX) amount: number;
  @IsString() @MinLength(3, { message: 'Détaillez le devis.' }) @MaxLength(2000) details: string;
  @IsOptional() @IsInt() @Min(5) @Max(60 * 24 * 60) durationMinutes?: number | null;
}

class DecisionDto {
  @IsBoolean() accept: boolean;
}

class PartDto {
  @IsIn(['STOCK', 'EXTERNAL']) source: 'STOCK' | 'EXTERNAL';
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() @MaxLength(140) label?: string;
  @IsInt() @Min(1) @Max(100) quantity: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX) unitCost?: number;
}

class NoteDto {
  @IsString() @MinLength(3, { message: 'Indiquez un motif.' }) @MaxLength(300) note: string;
}

class PaymentDto {
  @IsEnum(PaymentKind) kind: PaymentKind;
  @IsInt() @Min(1) @Max(MAX) amount: number;
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(80) externalReference?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class RepairQuery extends PageQuery {
  @IsOptional() @IsEnum(RepairStatus) status?: RepairStatus;
  @IsOptional() @IsIn(['open', 'ready', 'done', 'mine', 'late']) scope?: string;
  @IsOptional() @IsEnum(SettlementStatus) paymentStatus?: SettlementStatus;
  @IsOptional() @IsString() technicianId?: string;
}

const OPEN: RepairStatus[] = ['RECEIVED', 'DIAGNOSING', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'WAITING_PARTS', 'IN_PROGRESS'];

@Controller('repairs')
export class RepairsController {
  private readonly webOrigin = loadConfig().webOrigin;

  constructor(
    private readonly repairs: RepairsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Vue interne d'un dossier.
   * - Coût des pièces issues du stock, coûts totaux et marge : Responsable uniquement.
   * - Le réparateur voit les coûts qu'il saisit lui-même (pièces hors stock, consommables, autres coûts).
   */
  private present(job: RepairDetail, me: AuthUser) {
    const withCosts = can(me.role, 'costs.read');
    const { imeiEncrypted, ...rest } = job;
    return {
      ...rest,
      hasImei: Boolean(imeiEncrypted),
      trackingUrl: `${this.webOrigin}/suivi/${job.number}?code=${job.trackingCode}`,
      statusLabel: REPAIR_STATUS_LABELS[job.status],
      allowedTransitions: allowedRepairTransitions(job.status),
      consumablesCost: can(me.role, 'repairs.write') ? job.consumablesCost : null,
      otherDirectCosts: can(me.role, 'repairs.write') ? job.otherDirectCosts : null,
      parts: job.parts.map((p) => ({
        ...p,
        unitCost: withCosts || (p.source === 'EXTERNAL' && can(me.role, 'repairs.write')) ? p.unitCost : null,
        totalCost: withCosts || (p.source === 'EXTERNAL' && can(me.role, 'repairs.write')) ? p.totalCost : null,
      })),
      financials: withCosts ? { ...this.repairs.financials(job), amountPaid: job.amountPaid, balanceDue: job.billedAmount - job.amountPaid } : null,
      balanceDue: job.billedAmount - job.amountPaid,
    };
  }

  @Get()
  @RequirePermissions('repairs.read')
  async list(@Query() q: RepairQuery, @CurrentUser() me: AuthUser) {
    const where: Prisma.RepairJobWhereInput = { status: q.status, paymentStatus: q.paymentStatus, technicianId: q.technicianId };
    if (q.scope === 'open') where.status = { in: OPEN };
    if (q.scope === 'ready') where.status = 'COMPLETED';
    if (q.scope === 'done') where.status = { in: ['COMPLETED', 'PICKED_UP'] };
    if (q.scope === 'mine') Object.assign(where, { technicianId: me.id, status: { in: OPEN } });
    if (q.scope === 'late') Object.assign(where, { status: { in: OPEN }, dueAt: { lt: new Date() } });
    if (q.q) {
      const digits = q.q.replace(/\D/g, '');
      where.OR = [
        { number: { contains: q.q, mode: 'insensitive' } },
        { modelName: { contains: q.q, mode: 'insensitive' } },
        { customer: { name: { contains: q.q, mode: 'insensitive' } } },
        ...(digits.length >= 3 ? [{ customer: { phone: { contains: digits } } }] : []),
        ...(digits.length === 4 ? [{ imeiLast4: digits }] : []),
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.repairJob.findMany({
        where,
        select: {
          id: true, number: true, status: true, brandName: true, modelName: true, reportedIssue: true, receivedAt: true, dueAt: true,
          completedAt: true, deviceReturnedAt: true, billedAmount: true, amountPaid: true, paymentStatus: true,
          customer: { select: { id: true, name: true, phone: true } }, technician: { select: { id: true, name: true } },
          repairType: { select: { name: true } },
        },
        orderBy: q.scope === 'open' || q.scope === 'mine' ? [{ dueAt: { sort: 'asc', nulls: 'last' } }, { receivedAt: 'asc' }] : { receivedAt: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.repairJob.count({ where }),
    ]);
    return paginate(rows.map((r) => ({ ...r, statusLabel: REPAIR_STATUS_LABELS[r.status] })), total, q);
  }

  @Get(':id')
  @RequirePermissions('repairs.read')
  async get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.get(id), me);
  }

  @Post()
  @RequirePermissions('repairs.write')
  async create(@Body() dto: CreateRepairDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.create(dto, me.id), me);
  }

  @Patch(':id')
  @RequirePermissions('repairs.write')
  async update(@Param('id') id: string, @Body() dto: UpdateRepairDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.update(id, dto, me.id), me);
  }

  @Post(':id/status')
  @HttpCode(200)
  async status(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser() me: AuthUser) {
    // Remise au client : accessible au comptoir ; autres transitions : atelier.
    const permission = dto.status === 'PICKED_UP' ? 'repairs.handover' : 'repairs.write';
    if (!can(me.role, permission)) throw new ForbiddenException("Vous n'avez pas l'autorisation d'effectuer cette action.");
    return this.present(await this.repairs.changeStatus(id, dto.status, dto.note, me.id), me);
  }

  @Post(':id/device-returned')
  @HttpCode(200)
  @RequirePermissions('repairs.handover')
  async deviceReturned(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.markDeviceReturned(id, me.id), me);
  }

  @Post(':id/quotes')
  @RequirePermissions('repairs.write')
  async quote(@Param('id') id: string, @Body() dto: QuoteDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.createQuote(id, dto, me.id), me);
  }

  @Post(':id/quotes/:quoteId/decision')
  @HttpCode(200)
  @RequirePermissions('repairs.write')
  async decide(@Param('id') id: string, @Param('quoteId') quoteId: string, @Body() dto: DecisionDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.decideQuote(id, quoteId, dto.accept, 'STAFF', me.id), me);
  }

  @Post(':id/parts')
  @RequirePermissions('repairs.write')
  async addPart(@Param('id') id: string, @Body() dto: PartDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.addPart(id, dto, me.id), me);
  }

  @Post(':id/parts/:partId/return')
  @HttpCode(200)
  @RequirePermissions('repairs.write')
  async returnPart(@Param('id') id: string, @Param('partId') partId: string, @Body() dto: NoteDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.returnPart(id, partId, dto.note.trim(), me.id), me);
  }

  @Post(':id/payments')
  @RequirePermissions('repairs.payments')
  async payment(@Param('id') id: string, @Body() dto: PaymentDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.repairs.recordPayment(id, dto, me.id), me);
  }

  @Post(':id/imei')
  @HttpCode(200)
  @RequirePermissions('repairs.imei')
  imei(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.repairs.revealImei(id, me.id);
  }
}
