import { BadRequestException, Controller, Get, Module, Query, Res } from '@nestjs/common';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { loadConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { PERIOD_PRESETS, PeriodPreset, resolvePeriod } from './periods';
import { StatsService } from './stats.service';

class PeriodQuery {
  @IsOptional() @IsIn(PERIOD_PRESETS) period?: PeriodPreset;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

class ExportQuery extends PeriodQuery {
  @IsIn(['summary', 'sales', 'expenses']) type: 'summary' | 'sales' | 'expenses';
}

/** Échappement CSV (séparateur « ; », compatible avec Excel en français). */
function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Neutralise les formules (injection CSV) et protège les séparateurs.
    const safe = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

@Controller('stats')
export class StatsController {
  private readonly tz = loadConfig().timezone;

  constructor(
    private readonly stats: StatsService,
    private readonly prisma: PrismaService,
  ) {}

  private period(q: PeriodQuery) {
    try {
      return resolvePeriod(q.period ?? 'this_month', this.tz, new Date(), { from: q.from?.slice(0, 10), to: q.to?.slice(0, 10) });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Get('report')
  @RequirePermissions('stats.read')
  async report(@Query() q: PeriodQuery) {
    const [report, snapshot] = await Promise.all([this.stats.report(this.period(q)), this.stats.snapshot()]);
    return { ...report, snapshot };
  }

  /** Vue d'ensemble : file de travail de chacun, et chiffres du jour pour le Responsable. */
  @Get('overview')
  async overview(@CurrentUser() me: AuthUser) {
    const canOrders = can(me.role, 'orders.read');
    const [ordersPending, ordersInProgress, unpaidSales, lowStock] = await Promise.all([
      canOrders ? this.prisma.order.count({ where: { status: 'PENDING' } }) : null,
      canOrders ? this.prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] } } }) : null,
      canOrders ? this.prisma.order.count({ where: { status: 'COMPLETED', paymentStatus: { not: 'PAID' } } }) : null,
      can(me.role, 'stock.read')
        ? this.prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint AS count FROM "Product" WHERE "status" = 'ACTIVE' AND "stockQuantity" - "reservedQuantity" <= "lowStockThreshold"`.then((r) => Number(r[0].count))
        : null,
    ]);

    let today = null;
    if (can(me.role, 'stats.read')) {
      const p = resolvePeriod('today', this.tz);
      const [totals, snapshot] = await Promise.all([this.stats.totals(p.start, p.end, p.startDate, p.endDate), this.stats.snapshot()]);
      today = { period: p, totals, snapshot };
    }

    // Dernières ventes (accès rapide aux tickets et aux codes d'avis).
    const recentSales = canOrders
      ? await this.prisma.order.findMany({
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, number: true, status: true, total: true, paymentStatus: true, customerName: true, createdAt: true, _count: { select: { items: true } } },
        })
      : [];

    return { queue: { ordersPending, ordersInProgress, unpaidSales, lowStock }, recentSales, today };
  }

  @Get('export')
  @RequirePermissions('stats.read')
  async export(@Query() q: ExportQuery, @Res() res: Response) {
    const period = this.period(q);
    let rows: (string | number | null)[][] = [];
    const { start, end } = period;

    if (q.type === 'summary') {
      const report = await this.stats.report(period);
      rows = [
        ['Période', 'CA smartphones', 'CA accessoires', 'Livraison', 'CA total', 'Coûts directs', 'Marge brute', 'Encaissements', 'Dépenses générales'],
        ...report.series.map((s) => [s.bucket, s.phones, s.accessories, s.delivery, s.revenue, s.directCosts, s.grossMargin, s.cashIn, s.expenses]),
        [
          'Total',
          report.totals.revenuePhones,
          report.totals.revenueAccessories,
          report.totals.revenueDelivery,
          report.totals.revenue,
          report.totals.directCosts,
          report.totals.grossMargin,
          report.totals.cashIn,
          report.totals.expenses,
        ],
        [],
        ['Résultat estimé (marge brute − dépenses générales)', report.totals.estimatedResult],
      ];
    } else if (q.type === 'sales') {
      const items = await this.prisma.orderItem.findMany({
        where: { order: { status: 'COMPLETED', completedAt: { gte: start, lt: end } } },
        include: { order: { select: { number: true, completedAt: true, channel: true, customerName: true } } },
        orderBy: { order: { completedAt: 'asc' } },
      });
      rows = [
        ['Date', 'Commande', 'Canal', 'Client', 'Référence', 'Article', 'Quantité', 'Retournée', 'Prix unitaire', 'Total ligne', 'Coût unitaire', 'Marge brute'],
        ...items.map((i) => [
          i.order.completedAt!.toISOString().slice(0, 10),
          i.order.number,
          i.order.channel === 'ONLINE' ? 'En ligne' : 'Comptoir',
          i.order.customerName,
          i.sku,
          i.label,
          i.quantity,
          i.returnedQuantity,
          i.unitPrice,
          i.lineTotal,
          i.unitCost,
          (i.unitPrice - (i.unitCost ?? 0)) * (i.quantity - i.returnedQuantity),
        ]),
      ];
    } else {
      const expenses = await this.prisma.expense.findMany({
        where: { status: 'ACTIVE', expenseDate: { gte: new Date(`${period.startDate}T00:00:00Z`), lt: new Date(new Date(`${period.endDate}T00:00:00Z`).getTime() + 86400_000) } },
        include: { createdBy: { select: { name: true } } },
        orderBy: { expenseDate: 'asc' },
      });
      rows = [
        ['Date', 'Libellé', 'Catégorie', 'Montant', 'Moyen de paiement', 'Saisie par', 'Commentaire'],
        ...expenses.map((e) => [e.expenseDate.toISOString().slice(0, 10), e.label, e.category, e.amount, e.paymentMethod, e.createdBy.name, e.comment]),
      ];
    }

    const filename = `le-marchand-${q.type}-${period.startDate}_${period.endDate}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv(rows));
  }
}

@Module({ controllers: [StatsController], providers: [StatsService], exports: [StatsService] })
export class StatsModule {}
