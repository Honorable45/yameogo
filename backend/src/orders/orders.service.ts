import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FulfillmentMethod, OrderStatus, PaymentKind, PaymentMethod, PaymentPreference, Prisma } from '@prisma/client';
import { getSettings } from '../settings/settings.controller';
import { AuditService } from '../common/audit.service';
import { nextYearlyNumber } from '../common/counters';
import { CryptoService } from '../common/crypto.service';
import { sum } from '../common/money';
import { cleanOptional } from '../common/text';
import { CustomersService } from '../customers/customers.module';
import { StockService } from '../inventory/stock.service';
import { OnlinePaymentsService } from '../payments/online-payments.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { UsedPhonesService } from '../used-phones/used-phones.service';
import { canTransitionOrder, checkoutError, ORDER_STATUS_LABELS } from './order-rules';

export interface CartItemInput {
  productId?: string;
  usedPhoneId?: string;
  quantity: number;
  /** Prix unitaire négocié (vente au comptoir, Responsable uniquement). */
  unitPrice?: number;
}

interface PricedLine {
  productId: string | null;
  usedPhoneId: string | null;
  label: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  catalogPrice: number;
  lineTotal: number;
  available: number;
  issue: string | null;
}

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  fulfillment: FulfillmentMethod;
  deliveryAddress?: string;
  paymentPreference: PaymentPreference;
  comment?: string;
  items: CartItemInput[];
}

export interface CounterSaleInput {
  customerName?: string;
  customerPhone?: string;
  comment?: string;
  items: CartItemInput[];
  payments: { method: PaymentMethod; amount: number; externalReference?: string }[];
}

const detailInclude = {
  items: {
    include: {
      product: { select: { id: true, slug: true, images: { orderBy: { position: 'asc' as const }, take: 1 } } },
      usedPhone: { select: { id: true, slug: true, reference: true, images: { orderBy: { position: 'asc' as const }, take: 1 } } },
    },
  },
  payments: { orderBy: { createdAt: 'asc' as const }, include: { recordedBy: { select: { name: true } } } },
  history: { orderBy: { createdAt: 'asc' as const }, include: { user: { select: { name: true } } } },
  returns: { orderBy: { createdAt: 'asc' as const }, include: { createdBy: { select: { name: true } } } },
  customer: { select: { id: true, name: true, phone: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

/**
 * Commandes en ligne et ventes au comptoir.
 * Les prix et totaux sont toujours recalculés ici à partir du catalogue :
 * les montants envoyés par le navigateur ne sont jamais utilisés.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly phones: UsedPhonesService,
    private readonly payments: PaymentsService,
    private readonly online: OnlinePaymentsService,
    private readonly customers: CustomersService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  // ─── Panier

  /** Valorise un panier au prix du catalogue et signale les problèmes de disponibilité. */
  async priceCart(client: Tx | PrismaService, items: CartItemInput[], allowPriceOverride = false): Promise<PricedLine[]> {
    const productIds = items.map((i) => i.productId).filter((x): x is string => Boolean(x));
    const phoneIds = items.map((i) => i.usedPhoneId).filter((x): x is string => Boolean(x));
    if (new Set(productIds).size !== productIds.length || new Set(phoneIds).size !== phoneIds.length) {
      throw new BadRequestException('Un article apparaît plusieurs fois dans le panier.');
    }
    const [products, phones] = await Promise.all([
      client.product.findMany({ where: { id: { in: productIds } } }),
      client.usedPhone.findMany({ where: { id: { in: phoneIds } } }),
    ]);

    return items.map((item): PricedLine => {
      if (Boolean(item.productId) === Boolean(item.usedPhoneId)) throw new BadRequestException('Ligne de panier invalide.');
      if (item.unitPrice !== undefined && !allowPriceOverride) throw new ForbiddenException('Modification de prix non autorisée.');

      if (item.productId) {
        const p = products.find((x) => x.id === item.productId);
        if (!p) throw new BadRequestException('Un article du panier n’existe plus.');
        const available = Math.max(0, p.stockQuantity - p.reservedQuantity);
        const sellable = p.status === 'ACTIVE' && p.kind === 'ACCESSORY' && p.published;
        const unitPrice = item.unitPrice ?? p.salePrice;
        return {
          productId: p.id,
          usedPhoneId: null,
          label: p.name,
          sku: p.sku,
          quantity: item.quantity,
          unitPrice,
          catalogPrice: p.salePrice,
          lineTotal: unitPrice * item.quantity,
          available,
          issue: !sellable
            ? "Cet article n'est plus proposé à la vente."
            : available < item.quantity
              ? available === 0
                ? 'Épuisé'
                : `Seulement ${available} disponible${available > 1 ? 's' : ''}`
              : null,
        };
      }

      const phone = phones.find((x) => x.id === item.usedPhoneId);
      if (!phone) throw new BadRequestException('Un téléphone du panier n’existe plus.');
      if (item.quantity !== 1) throw new BadRequestException("Un téléphone d'occasion est un exemplaire unique (quantité 1).");
      const unitPrice = item.unitPrice ?? phone.salePrice;
      return {
        productId: null,
        usedPhoneId: phone.id,
        label: [phone.modelName, phone.storageGb ? `${phone.storageGb} Go` : null, phone.color, phone.condition === 'NEW' ? 'neuf' : phone.condition === 'IMPORTED' ? 'venu' : 'occasion'].filter(Boolean).join(' · '),
        sku: phone.reference,
        quantity: 1,
        unitPrice,
        catalogPrice: phone.salePrice,
        lineTotal: unitPrice,
        available: phone.status === 'AVAILABLE' ? 1 : 0,
        issue: phone.status === 'AVAILABLE' ? null : "Ce téléphone n'est plus disponible.",
      };
    });
  }

  async quote(items: CartItemInput[], fulfillment: FulfillmentMethod = 'PICKUP') {
    const settings = await getSettings(this.prisma);
    const lines = await this.priceCart(this.prisma, items);
    const subtotal = sum(lines.map((l) => l.lineTotal));
    const deliveryFee = fulfillment === 'DELIVERY' && settings.deliveryEnabled ? settings.deliveryFee : 0;
    return {
      lines: lines.map(({ catalogPrice: _c, ...l }) => l),
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      valid: lines.every((l) => !l.issue),
    };
  }

  // ─── Commande en ligne

  async checkout(input: CheckoutInput) {
    if (!input.items.length) throw new BadRequestException('Votre panier est vide.');
    const settings = await getSettings(this.prisma);
    const error = checkoutError(input.fulfillment, input.paymentPreference, {
      deliveryEnabled: settings.deliveryEnabled,
      payInStoreEnabled: settings.payInStoreEnabled,
      cashOnDeliveryEnabled: settings.cashOnDeliveryEnabled,
      mobileMoneyAvailable: settings.mobileMoneyEnabled && this.online.enabled,
    });
    if (error) throw new BadRequestException(error);
    if (input.fulfillment === 'DELIVERY' && !input.deliveryAddress?.trim()) {
      throw new BadRequestException('Indiquez une adresse de livraison.');
    }

    const order = await this.prisma.run(async (tx) => {
      const lines = await this.priceCart(tx, input.items);
      const problem = lines.find((l) => l.issue);
      if (problem) throw new ConflictException(`${problem.label} : ${problem.issue}`);

      const customer = await this.customers.findOrCreate(tx, { name: input.customerName, phone: input.customerPhone });
      const subtotal = sum(lines.map((l) => l.lineTotal));
      const deliveryFee = input.fulfillment === 'DELIVERY' ? settings.deliveryFee : 0;
      const number = await nextYearlyNumber(tx, 'C');

      const created = await tx.order.create({
        data: {
          number,
          accessToken: this.crypto.randomToken(24),
          channel: 'ONLINE',
          status: 'PENDING',
          customerId: customer.id,
          customerName: input.customerName.trim(),
          customerPhone: customer.phone,
          fulfillment: input.fulfillment,
          deliveryAddress: input.fulfillment === 'DELIVERY' ? input.deliveryAddress!.trim() : null,
          paymentPreference: input.paymentPreference,
          comment: cleanOptional(input.comment),
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          items: { create: lines.map((l) => this.itemData(l)) },
          history: { create: { toStatus: 'PENDING', note: 'Commande passée en ligne' } },
        },
      });
      await this.reserveLines(tx, lines, number);
      return created;
    });
    return { number: order.number, accessToken: order.accessToken, total: order.total };
  }

  private itemData(l: PricedLine) {
    return {
      productId: l.productId,
      usedPhoneId: l.usedPhoneId,
      label: l.label,
      sku: l.sku,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    };
  }

  /** Réservations dans un ordre déterministe (évite les interblocages entre commandes simultanées). */
  private async reserveLines(tx: Tx, lines: PricedLine[], orderNumber: string) {
    const sorted = [...lines].sort((a, b) => (a.productId ?? a.usedPhoneId!).localeCompare(b.productId ?? b.usedPhoneId!));
    for (const line of sorted) {
      if (line.productId) await this.stock.reserve(tx, line.productId, line.quantity);
      else await this.phones.reserve(tx, line.usedPhoneId!, orderNumber);
    }
  }

  // ─── Vente au comptoir

  async counterSale(input: CounterSaleInput, user: { id: string; canOverridePrice: boolean }) {
    if (!input.items.length) throw new BadRequestException('Ajoutez au moins un article.');
    const id = await this.prisma.run(async (tx) => {
      const lines = await this.priceCart(tx, input.items, user.canOverridePrice);
      for (const l of lines) {
        // Au comptoir, un article non publié en ligne peut être vendu s'il est actif et en stock.
        if (l.available < l.quantity) throw new ConflictException(`${l.label} : stock insuffisant.`);
      }
      const total = sum(lines.map((l) => l.lineTotal));
      const paid = sum(input.payments.map((p) => p.amount));
      if (paid > total) throw new BadRequestException(`Les paiements (${paid} XOF) dépassent le total (${total} XOF).`);

      const customer = input.customerPhone?.trim()
        ? await this.customers.findOrCreate(tx, { name: input.customerName, phone: input.customerPhone })
        : null;
      const number = await nextYearlyNumber(tx, 'C');
      const now = new Date();
      const order = await tx.order.create({
        data: {
          number,
          accessToken: this.crypto.randomToken(24),
          channel: 'IN_STORE',
          status: 'COMPLETED',
          customerId: customer?.id ?? null,
          customerName: input.customerName?.trim() || customer?.name || 'Client comptoir',
          customerPhone: customer?.phone ?? '',
          fulfillment: 'PICKUP',
          paymentPreference: 'PAY_IN_STORE',
          comment: cleanOptional(input.comment),
          subtotal: total,
          total,
          confirmedAt: now,
          completedAt: now,
          createdById: user.id,
          items: { create: lines.map((l) => this.itemData(l)) },
          history: { create: { toStatus: 'COMPLETED', note: 'Vente au comptoir', userId: user.id } },
        },
        include: { items: true },
      });
      await this.issueItems(tx, order.items, number, false, user.id);
      for (const p of input.payments.filter((x) => x.amount > 0)) {
        await this.payments.recordManual(tx, {
          target: { orderId: order.id },
          kind: 'PAYMENT',
          amount: p.amount,
          method: p.method,
          externalReference: p.externalReference,
          userId: user.id,
        });
      }
      const overridden = lines.filter((l) => l.unitPrice !== l.catalogPrice);
      await this.audit.log(
        {
          userId: user.id,
          action: 'order.counterSale',
          entity: 'Order',
          entityId: order.id,
          summary: `Vente ${number} : ${total} XOF${overridden.length ? ` (prix modifié sur ${overridden.length} ligne(s))` : ''}`,
          details: overridden.length ? { overridden: overridden.map((l) => ({ sku: l.sku, catalog: l.catalogPrice, sold: l.unitPrice })) } : undefined,
        },
        tx,
      );
      return order.id;
    });
    return this.get(id);
  }

  /** Sortie de stock des lignes et figement du coût unitaire. */
  private async issueItems(
    tx: Tx,
    items: { id: string; productId: string | null; usedPhoneId: string | null; quantity: number }[],
    orderNumber: string,
    fromReservation: boolean,
    userId: string | null,
  ) {
    const sorted = [...items].sort((a, b) => (a.productId ?? a.usedPhoneId!).localeCompare(b.productId ?? b.usedPhoneId!));
    for (const item of sorted) {
      const unitCost = item.productId
        ? await this.stock.issue(tx, {
            productId: item.productId,
            quantity: item.quantity,
            type: 'SALE',
            fromReservation,
            orderItemId: item.id,
            reason: `Commande ${orderNumber}`,
            userId,
          })
        : await this.phones.markSold(tx, item.usedPhoneId!, orderNumber, fromReservation, userId);
      await tx.orderItem.update({ where: { id: item.id }, data: { unitCost } });
    }
  }

  // ─── Cycle de vie

  async get(id: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: detailInclude });
    if (!order) throw new NotFoundException('Commande introuvable.');
    return order;
  }

  private async lockOrder(tx: Tx, id: string) {
    const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
    if (!row) throw new NotFoundException('Commande introuvable.');
    return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
  }

  async changeStatus(id: string, to: OrderStatus, note: string | undefined, userId: string) {
    await this.prisma.run(async (tx) => {
      const order = await this.lockOrder(tx, id);
      if (!canTransitionOrder(order.status, to, order.fulfillment)) {
        throw new ConflictException(`Passage impossible de « ${ORDER_STATUS_LABELS[order.status]} » à « ${ORDER_STATUS_LABELS[to]} ».`);
      }
      const data: Prisma.OrderUpdateInput = { status: to };

      if (to === 'CONFIRMED') data.confirmedAt = new Date();
      if (to === 'COMPLETED') {
        await this.issueItems(tx, order.items, order.number, true, userId);
        data.completedAt = new Date();
        if (!order.confirmedAt) data.confirmedAt = new Date();
      }
      if (to === 'CANCELLED') {
        if ((await this.payments.netPaid(tx, { orderId: id })) > 0) {
          throw new ConflictException("Cette commande a été (partiellement) payée : enregistrez d'abord le remboursement.");
        }
        const sorted = [...order.items].sort((a, b) => (a.productId ?? a.usedPhoneId!).localeCompare(b.productId ?? b.usedPhoneId!));
        for (const item of sorted) {
          if (item.productId) await this.stock.release(tx, item.productId, item.quantity);
          else await this.phones.release(tx, item.usedPhoneId!, order.number, userId);
        }
        // Les demandes de paiement en ligne encore en attente sont closes.
        await tx.payment.updateMany({ where: { orderId: id, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Commande annulée' } });
        data.cancelledAt = new Date();
        data.cancelReason = note?.trim() || null;
      }

      await tx.order.update({ where: { id }, data });
      await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus: to, note: note?.trim() || null, userId } });
      await this.audit.log(
        { userId, action: 'order.status', entity: 'Order', entityId: id, summary: `Commande ${order.number} : ${ORDER_STATUS_LABELS[order.status]} → ${ORDER_STATUS_LABELS[to]}` },
        tx,
      );
    });
    return this.get(id);
  }

  async recordPayment(
    id: string,
    input: { kind: PaymentKind; amount: number; method: PaymentMethod; externalReference?: string; note?: string },
    userId: string,
  ) {
    await this.prisma.run((tx) => this.payments.recordManual(tx, { target: { orderId: id }, ...input, userId }));
    return this.get(id);
  }

  /**
   * Retour d'un article après une vente terminée.
   * - Le chiffre d'affaires de la ligne est annulé à la date du retour.
   * - Article remis en stock : entrée SALE_RETURN au coût figé de la vente, coût annulé.
   * - Article non remis en stock (défectueux) : le coût reste une perte.
   * - Téléphone d'occasion : toujours repris (statut « Retourné », à revérifier avant remise en vente).
   */
  async registerReturn(
    id: string,
    input: { itemId: string; quantity: number; restock: boolean; reason: string; refund?: { method: PaymentMethod; amount: number } },
    userId: string,
  ) {
    await this.prisma.run(async (tx) => {
      const order = await this.lockOrder(tx, id);
      if (order.status !== 'COMPLETED') throw new ConflictException('Seule une commande terminée peut faire l’objet d’un retour.');
      const item = order.items.find((i) => i.id === input.itemId);
      if (!item) throw new NotFoundException('Ligne introuvable.');
      if (input.quantity > item.quantity - item.returnedQuantity) {
        throw new BadRequestException(`Quantité retournable maximale : ${item.quantity - item.returnedQuantity}.`);
      }
      const restock = item.usedPhoneId ? true : input.restock;
      const unitCost = item.unitCost ?? 0;
      const ret = await tx.orderReturn.create({
        data: {
          orderId: id,
          orderItemId: item.id,
          quantity: input.quantity,
          amount: item.unitPrice * input.quantity,
          costAmount: restock ? unitCost * input.quantity : 0,
          restocked: restock,
          reason: input.reason,
          createdById: userId,
        },
      });
      await tx.orderItem.update({ where: { id: item.id }, data: { returnedQuantity: { increment: input.quantity } } });
      if (item.productId && restock) {
        await this.stock.receive(tx, {
          productId: item.productId,
          quantity: input.quantity,
          unitCost,
          type: 'SALE_RETURN',
          reason: `Retour client — commande ${order.number} : ${input.reason}`,
          orderItemId: item.id,
          orderReturnId: ret.id,
          userId,
        });
      }
      if (item.usedPhoneId) await this.phones.markReturned(tx, item.usedPhoneId, order.number, input.reason, userId);
      if (input.refund && input.refund.amount > 0) {
        await this.payments.recordManual(tx, {
          target: { orderId: id },
          kind: 'REFUND',
          amount: input.refund.amount,
          method: input.refund.method,
          note: `Retour : ${item.label}`,
          userId,
        });
      }
      await tx.orderStatusHistory.create({
        data: { orderId: id, fromStatus: 'COMPLETED', toStatus: 'COMPLETED', note: `Retour de ${input.quantity} × ${item.label} : ${input.reason}`, userId },
      });
      await this.audit.log(
        { userId, action: 'order.return', entity: 'Order', entityId: id, summary: `Retour sur ${order.number} : ${input.quantity} × ${item.label} (${ret.amount} XOF)` },
        tx,
      );
    });
    return this.get(id);
  }

  // ─── Consultation par le client

  async publicView(number: string, token: string) {
    const order = await this.prisma.order.findUnique({ where: { number }, include: detailInclude });
    if (!order || !token || !this.crypto.safeEqual(order.accessToken, token)) {
      throw new NotFoundException('Commande introuvable.');
    }
    const pending = order.payments.find((p) => p.status === 'PENDING' && p.provider !== 'MANUAL');
    if (pending && this.online.enabled) await this.online.verify(pending.id).catch(() => undefined);
    const fresh = pending ? await this.get(order.id) : order;
    return {
      number: fresh.number,
      status: fresh.status,
      statusLabel: ORDER_STATUS_LABELS[fresh.status],
      createdAt: fresh.createdAt,
      customerName: fresh.customerName,
      fulfillment: fresh.fulfillment,
      deliveryAddress: fresh.deliveryAddress,
      paymentPreference: fresh.paymentPreference,
      subtotal: fresh.subtotal,
      deliveryFee: fresh.deliveryFee,
      total: fresh.total,
      amountPaid: fresh.amountPaid,
      paymentStatus: fresh.paymentStatus,
      onlinePayment: fresh.payments
        .filter((p) => p.provider !== 'MANUAL')
        .map((p) => ({ id: p.id, status: p.status, amount: p.amount, method: p.method, createdAt: p.createdAt }))
        .pop() ?? null,
      items: fresh.items.map((i) => ({ label: i.label, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      history: fresh.history.map((h) => ({ status: h.toStatus, label: ORDER_STATUS_LABELS[h.toStatus], at: h.createdAt })),
    };
  }

  async findByToken(number: string, token: string) {
    const order = await this.prisma.order.findUnique({ where: { number } });
    if (!order || !token || !this.crypto.safeEqual(order.accessToken, token)) throw new NotFoundException('Commande introuvable.');
    return order;
  }
}
