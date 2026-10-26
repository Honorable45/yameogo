import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentKind, PaymentMethod } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { settlementStatus } from '../common/money';
import { PrismaService, Tx } from '../prisma/prisma.service';

export type PaymentTarget = { orderId: string; repairJobId?: undefined } | { repairJobId: string; orderId?: undefined };

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  TMONEY: 'TMoney',
  FLOOZ: 'Flooz',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement',
  OTHER: 'Autre',
};

/**
 * Paiements et remboursements des commandes et des réparations.
 *
 * - Seuls les paiements CONFIRMED comptent dans les encaissements.
 * - Un paiement saisi par l'équipe (espèces, TMoney/Flooz reçu sur le téléphone de la boutique…)
 *   est confirmé par la personne qui l'enregistre, après vérification de la réception des fonds.
 * - Un paiement initié en ligne reste PENDING jusqu'à la confirmation vérifiée du prestataire.
 * - Une écriture n'est jamais supprimée : elle est annulée avec un motif.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Verrouille la cible et renvoie le montant dû, l'encaissé net et un libellé. */
  private async lockTarget(tx: Tx, target: PaymentTarget) {
    if (target.orderId) {
      const [row] = await tx.$queryRaw<{ total: number; status: string; number: string }[]>`
        SELECT "total", "status", "number" FROM "Order" WHERE "id" = ${target.orderId} FOR UPDATE`;
      if (!row) throw new NotFoundException('Commande introuvable.');
      return { due: row.total, cancelled: row.status === 'CANCELLED', label: `commande ${row.number}` };
    }
    const [row] = await tx.$queryRaw<{ billedAmount: number; status: string; number: string }[]>`
      SELECT "billedAmount", "status", "number" FROM "RepairJob" WHERE "id" = ${target.repairJobId} FOR UPDATE`;
    if (!row) throw new NotFoundException('Réparation introuvable.');
    return { due: row.billedAmount, cancelled: row.status === 'CANCELLED', label: `réparation ${row.number}` };
  }

  private where(target: PaymentTarget) {
    return target.orderId ? { orderId: target.orderId } : { repairJobId: target.repairJobId };
  }

  /** Encaissé net confirmé (paiements − remboursements). */
  async netPaid(tx: Tx, target: PaymentTarget) {
    const rows = await tx.payment.groupBy({
      by: ['kind'],
      where: { ...this.where(target), status: 'CONFIRMED' },
      _sum: { amount: true },
    });
    const paid = rows.find((r) => r.kind === 'PAYMENT')?._sum.amount ?? 0;
    const refunded = rows.find((r) => r.kind === 'REFUND')?._sum.amount ?? 0;
    return paid - refunded;
  }

  /** Recalcule le montant payé et le statut de règlement dénormalisés sur la cible. */
  async refreshTotals(tx: Tx, target: PaymentTarget) {
    const paid = await this.netPaid(tx, target);
    if (target.orderId) {
      const order = await tx.order.findUniqueOrThrow({ where: { id: target.orderId }, select: { total: true } });
      await tx.order.update({ where: { id: target.orderId }, data: { amountPaid: paid, paymentStatus: settlementStatus(order.total, paid) } });
    } else {
      const job = await tx.repairJob.findUniqueOrThrow({ where: { id: target.repairJobId }, select: { billedAmount: true } });
      await tx.repairJob.update({
        where: { id: target.repairJobId },
        data: { amountPaid: paid, paymentStatus: settlementStatus(job.billedAmount, paid) },
      });
    }
    return paid;
  }

  /** Enregistre un paiement ou un remboursement constaté par l'équipe. */
  async recordManual(
    tx: Tx,
    input: {
      target: PaymentTarget;
      kind: PaymentKind;
      amount: number;
      method: PaymentMethod;
      externalReference?: string | null;
      note?: string | null;
      userId: string;
    },
  ) {
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new BadRequestException('Montant invalide.');
    const target = await this.lockTarget(tx, input.target);
    const paid = await this.netPaid(tx, input.target);

    if (input.kind === 'PAYMENT') {
      if (target.cancelled) throw new ConflictException(`Impossible d'encaisser : la ${target.label} est annulée.`);
      if (paid + input.amount > target.due) {
        throw new BadRequestException(
          target.due - paid <= 0
            ? `La ${target.label} est déjà entièrement réglée.`
            : `Le montant dépasse le reste à payer (${target.due - paid} XOF).`,
        );
      }
    } else if (input.amount > paid) {
      throw new BadRequestException(`Le remboursement dépasse le montant encaissé (${paid} XOF).`);
    }

    const payment = await tx.payment.create({
      data: {
        ...this.where(input.target),
        kind: input.kind,
        method: input.method,
        status: 'CONFIRMED',
        amount: input.amount,
        provider: 'MANUAL',
        externalReference: input.externalReference?.trim() || null,
        note: input.note?.trim() || null,
        confirmedAt: new Date(),
        recordedById: input.userId,
      },
    });
    await this.refreshTotals(tx, input.target);
    await this.audit.log(
      {
        userId: input.userId,
        action: input.kind === 'PAYMENT' ? 'payment.record' : 'payment.refund',
        entity: 'Payment',
        entityId: payment.id,
        summary: `${input.kind === 'PAYMENT' ? 'Paiement' : 'Remboursement'} de ${input.amount} XOF (${METHOD_LABELS[input.method]}) — ${target.label}`,
      },
      tx,
    );
    return payment;
  }

  /** Annulation d'une écriture erronée (correction tracée, sans suppression). */
  async cancel(paymentId: string, reason: string, userId: string) {
    return this.prisma.run(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Paiement introuvable.');
      const target: PaymentTarget = payment.orderId ? { orderId: payment.orderId } : { repairJobId: payment.repairJobId! };
      await this.lockTarget(tx, target);
      if (payment.status === 'CANCELLED') throw new ConflictException('Cette écriture est déjà annulée.');
      if (payment.provider !== 'MANUAL' && payment.status === 'CONFIRMED') {
        throw new ConflictException('Un paiement confirmé par le prestataire ne peut pas être annulé : enregistrez un remboursement.');
      }
      if (payment.kind === 'PAYMENT' && payment.status === 'CONFIRMED') {
        // Annuler un paiement ne doit pas rendre le net encaissé négatif (remboursements existants).
        const paid = await this.netPaid(tx, target);
        if (paid - payment.amount < 0) throw new ConflictException("Annulez d'abord les remboursements liés à ce paiement.");
      }
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
      await this.refreshTotals(tx, target);
      await this.audit.log(
        { userId, action: 'payment.cancel', entity: 'Payment', entityId: paymentId, summary: `Écriture de ${payment.amount} XOF annulée : ${reason}` },
        tx,
      );
      return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    });
  }
}
