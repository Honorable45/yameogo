import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { nextYearlyNumber } from '../common/counters';
import { allocateProRata, settlementStatus, sum } from '../common/money';
import { StockService } from '../inventory/stock.service';
import { PrismaService, Tx } from '../prisma/prisma.service';

export interface PurchaseInput {
  supplierId: string;
  invoiceNumber?: string;
  purchaseDate: string;
  extraCosts: number;
  note?: string;
  items: { productId: string; quantity: number; unitCost: number }[];
}

const detailInclude = {
  supplier: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true, kind: true } } } },
  payments: { orderBy: { paidAt: 'asc' as const }, include: { recordedBy: { select: { name: true } } } },
};

/**
 * Approvisionnements.
 * Un brouillon n'a aucun effet sur le stock. La validation crée une entrée PURCHASE par ligne,
 * valorisée au coût de revient : (prix unitaire × quantité + part des frais annexes) / quantité.
 * Un achat de stock n'est jamais une dépense générale : il entre dans les coûts au moment de la vente.
 */
@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly audit: AuditService,
  ) {}

  get(id: string) {
    return this.prisma.purchase.findUnique({ where: { id }, include: detailInclude }).then((p) => {
      if (!p) throw new NotFoundException('Approvisionnement introuvable.');
      return p;
    });
  }

  private async checkInput(tx: Tx, input: PurchaseInput) {
    if (!input.items.length) throw new BadRequestException('Ajoutez au moins un article.');
    const ids = input.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Un article apparaît plusieurs fois : regroupez les quantités.');
    const products = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (products.length !== ids.length) throw new BadRequestException('Article introuvable dans la liste.');
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new BadRequestException('Fournisseur introuvable.');
  }

  private lines(input: PurchaseInput) {
    const items = input.items.map((i) => ({ ...i, lineTotal: i.quantity * i.unitCost }));
    const itemsTotal = sum(items.map((i) => i.lineTotal));
    return { items, itemsTotal, total: itemsTotal + input.extraCosts };
  }

  async create(input: PurchaseInput, userId: string) {
    const id = await this.prisma.run(async (tx) => {
      await this.checkInput(tx, input);
      const { items, itemsTotal, total } = this.lines(input);
      const purchase = await tx.purchase.create({
        data: {
          number: await nextYearlyNumber(tx, 'A', new Date(input.purchaseDate), 4),
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber?.trim() || null,
          purchaseDate: new Date(input.purchaseDate),
          extraCosts: input.extraCosts,
          itemsTotal,
          total,
          note: input.note?.trim() || null,
          createdById: userId,
          items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost, lineTotal: i.lineTotal })) },
        },
      });
      await this.audit.log({ userId, action: 'purchase.create', entity: 'Purchase', entityId: purchase.id, summary: `Approvisionnement ${purchase.number} créé (brouillon)` }, tx);
      return purchase.id;
    });
    return this.get(id);
  }

  async update(id: string, input: PurchaseInput, userId: string) {
    await this.prisma.run(async (tx) => {
      const current = await tx.purchase.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Approvisionnement introuvable.');
      if (current.status !== 'DRAFT') throw new ConflictException('Seul un brouillon peut être modifié.');
      await this.checkInput(tx, input);
      const { items, itemsTotal, total } = this.lines(input);
      if (total < current.amountPaid) throw new BadRequestException('Le total ne peut pas être inférieur aux règlements déjà enregistrés.');
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchase.update({
        where: { id },
        data: {
          supplierId: input.supplierId,
          invoiceNumber: input.invoiceNumber?.trim() || null,
          purchaseDate: new Date(input.purchaseDate),
          extraCosts: input.extraCosts,
          itemsTotal,
          total,
          paymentStatus: settlementStatus(total, current.amountPaid),
          note: input.note?.trim() || null,
          items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost, lineTotal: i.lineTotal })) },
        },
      });
      await this.audit.log({ userId, action: 'purchase.update', entity: 'Purchase', entityId: id, summary: `Brouillon ${current.number} modifié` }, tx);
    });
    return this.get(id);
  }

  async validate(id: string, userId: string) {
    await this.prisma.run(async (tx) => {
      // Verrou sur l'approvisionnement : empêche une double validation simultanée.
      const [row] = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Purchase" WHERE "id" = ${id} FOR UPDATE`;
      if (!row) throw new NotFoundException('Approvisionnement introuvable.');
      if (row.status !== 'DRAFT') throw new ConflictException('Cet approvisionnement a déjà été traité.');

      const purchase = await tx.purchase.findUniqueOrThrow({ where: { id }, include: { items: true } });
      const shares = allocateProRata(purchase.extraCosts, purchase.items.map((i) => i.lineTotal));

      // Ordre déterministe des verrous produits pour éviter les interblocages.
      const ordered = purchase.items.map((item, idx) => ({ item, share: shares[idx] })).sort((a, b) => a.item.productId.localeCompare(b.item.productId));
      for (const { item, share } of ordered) {
        const landedUnitCost = Math.round((item.lineTotal + share) / item.quantity);
        await tx.purchaseItem.update({ where: { id: item.id }, data: { allocatedExtra: share, landedUnitCost } });
        await this.stock.receive(tx, {
          productId: item.productId,
          quantity: item.quantity,
          unitCost: landedUnitCost,
          type: 'PURCHASE',
          reason: `Approvisionnement ${purchase.number}`,
          purchaseItemId: item.id,
          userId,
        });
      }
      await tx.purchase.update({ where: { id }, data: { status: 'VALIDATED', validatedAt: new Date() } });
      await this.audit.log(
        { userId, action: 'purchase.validate', entity: 'Purchase', entityId: id, summary: `Approvisionnement ${purchase.number} validé : ${purchase.total} XOF` },
        tx,
      );
    });
    return this.get(id);
  }

  async cancel(id: string, reason: string, userId: string) {
    await this.prisma.run(async (tx) => {
      const [row] = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Purchase" WHERE "id" = ${id} FOR UPDATE`;
      if (!row) throw new NotFoundException('Approvisionnement introuvable.');
      if (row.status === 'CANCELLED') throw new ConflictException('Cet approvisionnement est déjà annulé.');

      const purchase = await tx.purchase.findUniqueOrThrow({ where: { id }, include: { items: true } });
      if (purchase.amountPaid > 0) {
        throw new ConflictException("Annulez d'abord les règlements enregistrés pour cet approvisionnement.");
      }
      if (row.status === 'VALIDATED') {
        // Retrait des quantités reçues ; impossible si elles ont déjà été vendues ou utilisées.
        const ordered = [...purchase.items].sort((a, b) => a.productId.localeCompare(b.productId));
        for (const item of ordered) {
          await this.stock.removeLot(tx, {
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.landedUnitCost,
            reason: `Annulation de l'approvisionnement ${purchase.number} : ${reason}`,
            purchaseItemId: item.id,
            userId,
          });
        }
      }
      await tx.purchase.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.audit.log({ userId, action: 'purchase.cancel', entity: 'Purchase', entityId: id, summary: `Approvisionnement ${purchase.number} annulé : ${reason}` }, tx);
    });
    return this.get(id);
  }

  async addPayment(id: string, input: { amount: number; method: PaymentMethod; paidAt: string; note?: string }, userId: string) {
    await this.prisma.run(async (tx) => {
      const [row] = await tx.$queryRaw<{ status: string; total: number; amountPaid: number; number: string }[]>`
        SELECT "status", "total", "amountPaid", "number" FROM "Purchase" WHERE "id" = ${id} FOR UPDATE`;
      if (!row) throw new NotFoundException('Approvisionnement introuvable.');
      if (row.status === 'CANCELLED') throw new ConflictException('Approvisionnement annulé.');
      if (row.amountPaid + input.amount > row.total) {
        throw new BadRequestException(`Le règlement dépasse le reste à payer (${row.total - row.amountPaid} XOF).`);
      }
      await tx.purchasePayment.create({
        data: { purchaseId: id, amount: input.amount, method: input.method, paidAt: new Date(input.paidAt), note: input.note?.trim() || null, recordedById: userId },
      });
      const paid = row.amountPaid + input.amount;
      await tx.purchase.update({ where: { id }, data: { amountPaid: paid, paymentStatus: settlementStatus(row.total, paid) } });
      await this.audit.log({ userId, action: 'purchase.payment', entity: 'Purchase', entityId: id, summary: `Règlement fournisseur de ${input.amount} XOF (${row.number})` }, tx);
    });
    return this.get(id);
  }

  async cancelPayment(id: string, paymentId: string, reason: string, userId: string) {
    await this.prisma.run(async (tx) => {
      const [row] = await tx.$queryRaw<{ total: number; amountPaid: number; number: string }[]>`
        SELECT "total", "amountPaid", "number" FROM "Purchase" WHERE "id" = ${id} FOR UPDATE`;
      if (!row) throw new NotFoundException('Approvisionnement introuvable.');
      const payment = await tx.purchasePayment.findFirst({ where: { id: paymentId, purchaseId: id } });
      if (!payment) throw new NotFoundException('Règlement introuvable.');
      if (payment.cancelledAt) throw new ConflictException('Ce règlement est déjà annulé.');
      await tx.purchasePayment.update({ where: { id: paymentId }, data: { cancelledAt: new Date(), cancelReason: reason } });
      const paid = row.amountPaid - payment.amount;
      await tx.purchase.update({ where: { id }, data: { amountPaid: paid, paymentStatus: settlementStatus(row.total, paid) } });
      await this.audit.log({ userId, action: 'purchase.payment.cancel', entity: 'Purchase', entityId: id, summary: `Règlement de ${payment.amount} XOF annulé (${row.number}) : ${reason}` }, tx);
    });
    return this.get(id);
  }
}
