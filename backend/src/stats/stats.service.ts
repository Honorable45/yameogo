import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { loadConfig } from '../config/env';
import { EXPENSE_CATEGORY_LABELS } from '../expenses/expenses.module';
import { PrismaService } from '../prisma/prisma.service';
import { bucketsOf, Granularity, ResolvedPeriod } from './periods';

/**
 * Règles de calcul (aucune valeur n'est estimée ni inventée) :
 *
 * Chiffre d'affaires (CA)
 *   - Smartphones / accessoires (selon le type de l'article vendu) : lignes des commandes TERMINÉES,
 *     à la date de fin de la commande.
 *   - Livraison : frais de livraison des commandes terminées.
 *   - Retours : déduits du CA à la date du retour.
 *   Les commandes annulées ne comptent jamais.
 *
 * Encaissements : paiements CONFIRMÉS à leur date de confirmation, moins les remboursements.
 *   Distincts du CA : une vente à crédit compte dans le CA, pas dans les encaissements.
 *
 * Coûts directs
 *   - Ventes : coût unitaire figé à la sortie de stock × quantité (coût moyen pondéré de l'article),
 *     moins le coût des articles retournés et remis en stock.
 *   Les achats de stock ne sont PAS des coûts de la période : ils le deviennent à la vente.
 *
 * Marge brute = CA − coûts directs.
 * Dépenses générales : dépenses actives, à leur date (les dépenses annulées ou corrigées sont exclues).
 * Résultat estimé = marge brute − dépenses générales (avant impôts et amortissements : ce n'est pas un bénéfice net).
 */

export interface PeriodTotals {
  revenue: number;
  revenueAccessories: number;
  revenuePhones: number;
  revenueDelivery: number;
  returns: number;
  costAccessories: number;
  costPhones: number;
  directCosts: number;
  grossMargin: number;
  expenses: number;
  estimatedResult: number;
  cashIn: number;
  cashInOrders: number;
  refunds: number;
  ordersCount: number;
  completedOrders: number;
}

export interface SeriesPoint {
  bucket: string;
  revenue: number;
  accessories: number;
  phones: number;
  delivery: number;
  directCosts: number;
  grossMargin: number;
  cashIn: number;
  expenses: number;
}

type Row = Record<string, unknown> & { bucket: string };
const n = (v: unknown) => Number(v ?? 0);

@Injectable()
export class StatsService {
  private readonly tz = loadConfig().timezone;

  constructor(private readonly prisma: PrismaService) {}

  private bucket(column: Prisma.Sql, granularity: Granularity) {
    const fmt = granularity === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    return Prisma.sql`to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${this.tz}, ${fmt})`;
  }

  /** Lignes agrégées par intervalle pour une plage [start, end[. */
  private async rows(start: Date, end: Date, startDate: string, endDate: string, g: Granularity) {
    const q = <T>(sql: Prisma.Sql) => this.prisma.$queryRaw<T[]>(sql);
    const [sales, delivery, returns, payments, expenses] = await Promise.all([
      q<Row & { activity: string; revenue: bigint; cost: bigint }>(Prisma.sql`
        SELECT ${this.bucket(Prisma.sql`o."completedAt"`, g)} AS bucket,
               p."kind"::text AS activity,
               SUM(oi."lineTotal")::bigint AS revenue,
               SUM(COALESCE(oi."unitCost", 0) * oi."quantity")::bigint AS cost
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" JOIN "Product" p ON p."id" = oi."productId"
        WHERE o."status" = 'COMPLETED' AND o."completedAt" >= ${start} AND o."completedAt" < ${end}
        GROUP BY 1, 2`),
      q<Row & { fees: bigint }>(Prisma.sql`
        SELECT ${this.bucket(Prisma.sql`"completedAt"`, g)} AS bucket, SUM("deliveryFee")::bigint AS fees
        FROM "Order" WHERE "status" = 'COMPLETED' AND "completedAt" >= ${start} AND "completedAt" < ${end}
        GROUP BY 1`),
      q<Row & { activity: string; amount: bigint; cost: bigint }>(Prisma.sql`
        SELECT ${this.bucket(Prisma.sql`r."createdAt"`, g)} AS bucket,
               p."kind"::text AS activity,
               SUM(r."amount")::bigint AS amount, SUM(r."costAmount")::bigint AS cost
        FROM "OrderReturn" r JOIN "OrderItem" oi ON oi."id" = r."orderItemId" JOIN "Product" p ON p."id" = oi."productId"
        WHERE r."createdAt" >= ${start} AND r."createdAt" < ${end}
        GROUP BY 1, 2`),
      q<Row & { kind: string; amount: bigint }>(Prisma.sql`
        SELECT ${this.bucket(Prisma.sql`"confirmedAt"`, g)} AS bucket,
               "kind"::text AS kind, SUM("amount")::bigint AS amount
        FROM "Payment"
        WHERE "status" = 'CONFIRMED' AND "confirmedAt" >= ${start} AND "confirmedAt" < ${end}
        GROUP BY 1, 2`),
      // Les dépenses portent une date calendaire (sans heure) : pas de conversion de fuseau.
      q<Row & { amount: bigint }>(Prisma.sql`
        SELECT to_char("expenseDate", ${g === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'}) AS bucket, SUM("amount")::bigint AS amount
        FROM "Expense"
        WHERE "status" = 'ACTIVE' AND "expenseDate" >= ${startDate}::date AND "expenseDate" < (${endDate}::date + 1)
        GROUP BY 1`),
    ]);
    return { sales, delivery, returns, payments, expenses };
  }

  private summarize(rows: Awaited<ReturnType<StatsService['rows']>>, bucket?: string): Omit<PeriodTotals, 'ordersCount' | 'completedOrders'> {
    const pick = <T extends Row>(list: T[]) => (bucket ? list.filter((r) => r.bucket === bucket) : list);
    const total = <T extends Row>(list: T[], field: keyof T, filter?: (r: T) => boolean) =>
      pick(list)
        .filter((r) => (filter ? filter(r) : true))
        .reduce((acc, r) => acc + n(r[field]), 0);

    const returnsAcc = total(rows.returns, 'amount', (r) => r.activity === 'ACCESSORY');
    const returnsPhone = total(rows.returns, 'amount', (r) => r.activity === 'PHONE');
    const revenueAccessories = total(rows.sales, 'revenue', (r) => r.activity === 'ACCESSORY') - returnsAcc;
    const revenuePhones = total(rows.sales, 'revenue', (r) => r.activity === 'PHONE') - returnsPhone;
    const revenueDelivery = total(rows.delivery, 'fees');
    const costAccessories = total(rows.sales, 'cost', (r) => r.activity === 'ACCESSORY') - total(rows.returns, 'cost', (r) => r.activity === 'ACCESSORY');
    const costPhones = total(rows.sales, 'cost', (r) => r.activity === 'PHONE') - total(rows.returns, 'cost', (r) => r.activity === 'PHONE');
    const revenue = revenueAccessories + revenuePhones + revenueDelivery;
    const directCosts = costAccessories + costPhones;
    const grossMargin = revenue - directCosts;
    const expenses = total(rows.expenses, 'amount');
    const pay = (kind: string) => total(rows.payments, 'amount', (r) => r.kind === kind);
    const cashInOrders = pay('PAYMENT') - pay('REFUND');

    return {
      revenue,
      revenueAccessories,
      revenuePhones,
      revenueDelivery,
      returns: returnsAcc + returnsPhone,
      costAccessories,
      costPhones,
      directCosts,
      grossMargin,
      expenses,
      estimatedResult: grossMargin - expenses,
      cashIn: cashInOrders,
      cashInOrders,
      refunds: pay('REFUND'),
    };
  }

  private async counts(start: Date, end: Date) {
    const [ordersCount, completedOrders] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } } }),
      this.prisma.order.count({ where: { completedAt: { gte: start, lt: end }, status: 'COMPLETED' } }),
    ]);
    return { ordersCount, completedOrders };
  }

  async totals(start: Date, end: Date, startDate: string, endDate: string): Promise<PeriodTotals> {
    const [rows, counts] = await Promise.all([this.rows(start, end, startDate, endDate, 'day'), this.counts(start, end)]);
    return { ...this.summarize(rows), ...counts };
  }

  async report(period: ResolvedPeriod) {
    const [rows, counts, previous, topProducts, expensesByCategory] = await Promise.all([
      this.rows(period.start, period.end, period.startDate, period.endDate, period.granularity),
      this.counts(period.start, period.end),
      this.totals(period.previous.start, period.previous.end, period.previous.startDate, period.previous.endDate),
      this.topProducts(period.start, period.end),
      this.expensesByCategory(period.startDate, period.endDate),
    ]);
    const series: SeriesPoint[] = bucketsOf(period).map((bucket) => {
      const s = this.summarize(rows, bucket);
      return {
        bucket,
        revenue: s.revenue,
        accessories: s.revenueAccessories,
        phones: s.revenuePhones,
        delivery: s.revenueDelivery,
        directCosts: s.directCosts,
        grossMargin: s.grossMargin,
        cashIn: s.cashIn,
        expenses: s.expenses,
      };
    });
    return {
      period,
      totals: { ...this.summarize(rows), ...counts },
      previous,
      series,
      topProducts,
      expensesByCategory,
    };
  }

  private async topProducts(start: Date, end: Date) {
    const rows = await this.prisma.$queryRaw<{ productId: string; label: string; sku: string; quantity: bigint; revenue: bigint; cost: bigint }[]>`
      SELECT oi."productId", MAX(oi."label") AS label, MAX(oi."sku") AS sku,
             SUM(oi."quantity" - oi."returnedQuantity")::bigint AS quantity,
             SUM(oi."unitPrice" * (oi."quantity" - oi."returnedQuantity"))::bigint AS revenue,
             SUM(COALESCE(oi."unitCost", 0) * (oi."quantity" - oi."returnedQuantity"))::bigint AS cost
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."status" = 'COMPLETED' AND o."completedAt" >= ${start} AND o."completedAt" < ${end}
      GROUP BY oi."productId"
      HAVING SUM(oi."quantity" - oi."returnedQuantity") > 0
      ORDER BY quantity DESC, revenue DESC
      LIMIT 10`;
    return rows.map((r) => ({ productId: r.productId, label: r.label, sku: r.sku, quantity: n(r.quantity), revenue: n(r.revenue), grossMargin: n(r.revenue) - n(r.cost) }));
  }

  private async expensesByCategory(startDate: string, endDate: string) {
    const rows = await this.prisma.$queryRaw<{ category: keyof typeof EXPENSE_CATEGORY_LABELS; amount: bigint }[]>`
      SELECT "category", SUM("amount")::bigint AS amount FROM "Expense"
      WHERE "status" = 'ACTIVE' AND "expenseDate" >= ${startDate}::date AND "expenseDate" < (${endDate}::date + 1)
      GROUP BY 1 ORDER BY 2 DESC`;
    return rows.map((r) => ({ category: r.category, label: EXPENSE_CATEGORY_LABELS[r.category], amount: n(r.amount) }));
  }

  /** Situation instantanée (indépendante de la période). */
  async snapshot() {
    const [stock] = await this.prisma.$queryRaw<{ phones: bigint | null; accessories: bigint | null }[]>`
      SELECT SUM("stockQuantity" * "averageCost") FILTER (WHERE "kind" = 'PHONE')::bigint AS phones,
             SUM("stockQuantity" * "averageCost") FILTER (WHERE "kind" = 'ACCESSORY')::bigint AS accessories
      FROM "Product" WHERE "status" = 'ACTIVE'`;
    const [restock] = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Product" WHERE "status" = 'ACTIVE' AND "stockQuantity" - "reservedQuantity" <= "lowStockThreshold"`;
    // Ventes conclues non entièrement réglées (ventes à crédit).
    const [receivables] = await this.prisma.$queryRaw<{ amount: bigint | null }[]>`
      SELECT SUM("total" - "amountPaid")::bigint AS amount FROM "Order" WHERE "status" = 'COMPLETED' AND "total" > "amountPaid"`;
    return {
      stockValue: n(stock.phones) + n(stock.accessories),
      stockValuePhones: n(stock.phones),
      stockValueAccessories: n(stock.accessories),
      productsToRestock: n(restock.count),
      unpaidOrders: n(receivables.amount),
    };
  }
}
