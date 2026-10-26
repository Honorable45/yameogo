import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsString, MaxLength } from 'class-validator';
import { Public } from '../auth/decorators';
import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { REPAIR_STATUS_LABELS } from './repair-rules';
import { RepairsService } from './repairs.service';

class DecisionDto {
  @IsString() @MaxLength(20) code: string;
  @IsBoolean() accept: boolean;
}

/**
 * Suivi public d'une réparation : numéro de dossier + code de suivi remis au client.
 * Aucune donnée interne (coûts, notes, IMEI, réparateur) n'est exposée.
 */
@Public()
@Controller('track')
export class TrackingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repairs: RepairsService,
    private readonly crypto: CryptoService,
  ) {}

  private async find(number: string, code: string) {
    const job = await this.prisma.repairJob.findUnique({
      where: { number: number.trim().toUpperCase() },
      include: {
        quotes: { where: { status: { in: ['PENDING', 'ACCEPTED', 'REFUSED'] } }, orderBy: { version: 'desc' } },
        history: { where: { type: { in: ['STATUS', 'QUOTE'] } }, orderBy: { createdAt: 'asc' } },
        customer: { select: { name: true } },
      },
    });
    // Même réponse si le dossier n'existe pas ou si le code est faux : pas d'énumération possible.
    if (!job || !code || !this.crypto.safeEqual(job.trackingCode, code.trim().toUpperCase())) {
      throw new NotFoundException('Aucun dossier ne correspond à ce numéro et à ce code.');
    }
    return job;
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':number')
  async view(@Param('number') number: string, @Query('code') code: string) {
    const job = await this.find(number, code ?? '');
    const pending = job.quotes.find((q) => q.status === 'PENDING');
    return {
      number: job.number,
      customerFirstName: job.customer.name.split(' ')[0],
      device: `${job.brandName} ${job.modelName}`,
      reportedIssue: job.reportedIssue,
      status: job.status,
      statusLabel: REPAIR_STATUS_LABELS[job.status],
      receivedAt: job.receivedAt,
      dueAt: job.dueAt,
      completedAt: job.completedAt,
      deviceReturned: Boolean(job.deviceReturnedAt),
      billedAmount: job.billedAmount,
      amountPaid: job.amountPaid,
      balanceDue: Math.max(0, job.billedAmount - job.amountPaid),
      paymentStatus: job.paymentStatus,
      pendingQuote: pending ? { id: pending.id, version: pending.version, amount: pending.amount, details: pending.details, durationMinutes: pending.durationMinutes, createdAt: pending.createdAt } : null,
      quotes: job.quotes.map((q) => ({ version: q.version, amount: q.amount, status: q.status, decidedAt: q.decidedAt })),
      timeline: job.history.map((h) => ({ type: h.type, status: h.toStatus, label: h.type === 'STATUS' && h.toStatus ? REPAIR_STATUS_LABELS[h.toStatus] : h.message.replace(/ par le client.*$/, ''), at: h.createdAt })),
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':number/quotes/:quoteId/decision')
  @HttpCode(200)
  async decide(@Param('number') number: string, @Param('quoteId') quoteId: string, @Body() dto: DecisionDto) {
    const job = await this.find(number, dto.code);
    await this.repairs.decideQuote(job.id, quoteId, dto.accept, 'CUSTOMER', null);
    return this.view(number, dto.code);
  }
}
