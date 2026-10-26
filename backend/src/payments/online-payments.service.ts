import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaygateNetwork, PaygateProvider } from './paygate.provider';
import { PaymentsService } from './payments.service';

/** Paiement mobile en ligne d'une commande (TMoney / Flooz). */
@Injectable()
export class OnlinePaymentsService {
  private readonly logger = new Logger(OnlinePaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paygate: PaygateProvider,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  get enabled() {
    return this.paygate.enabled;
  }

  async initiate(orderId: string, network: PaygateNetwork, phone: string) {
    const settings = await this.prisma.businessSettings.findUnique({ where: { id: 1 } });
    if (!this.paygate.enabled || !settings?.mobileMoneyEnabled) {
      throw new BadRequestException("Le paiement mobile en ligne n'est pas disponible. Choisissez un autre mode de paiement.");
    }
    const payment = await this.prisma.run(async (tx) => {
      const [order] = await tx.$queryRaw<{ id: string; number: string; total: number; status: string }[]>`
        SELECT "id", "number", "total", "status" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
      if (!order) throw new NotFoundException('Commande introuvable.');
      if (order.status === 'CANCELLED' || order.status === 'COMPLETED') throw new ConflictException('Cette commande ne peut plus être réglée en ligne.');
      const pending = await tx.payment.findFirst({ where: { orderId, status: 'PENDING', createdAt: { gte: new Date(Date.now() - 10 * 60_000) } } });
      if (pending) throw new ConflictException('Une demande de paiement est déjà en cours. Validez-la sur votre téléphone ou patientez quelques minutes.');
      const due = order.total - (await this.payments.netPaid(tx, { orderId }));
      if (due <= 0) throw new ConflictException('Cette commande est déjà réglée.');
      const created = await tx.payment.create({
        data: { orderId, kind: 'PAYMENT', method: network, status: 'PENDING', amount: due, provider: 'PAYGATE', payerPhone: phone },
      });
      // L'identifiant transmis au prestataire est l'identifiant interne du paiement.
      return tx.payment.update({ where: { id: created.id }, data: { providerReference: created.id }, include: { order: { select: { number: true } } } });
    });

    try {
      const { txReference } = await this.paygate.requestPayment({
        identifier: payment.id,
        amount: payment.amount,
        phone,
        network,
        description: `YAMEOGO - commande ${payment.order!.number}`,
      });
      await this.prisma.payment.update({ where: { id: payment.id }, data: { externalReference: txReference } });
    } catch (err) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', note: 'Demande refusée par le prestataire' } });
      throw err;
    }
    return { paymentId: payment.id, amount: payment.amount, status: 'PENDING' as const };
  }

  /**
   * Vérifie auprès du prestataire le statut d'un paiement en attente.
   * Appelé par la notification du prestataire et par la page de suivi du client.
   */
  async verify(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.provider !== 'PAYGATE') throw new NotFoundException('Paiement introuvable.');
    if (payment.status !== 'PENDING') return payment.status;

    const remote = await this.paygate.checkStatus(payment.id);
    return this.prisma.run(async (tx) => {
      const [current] = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`;
      if (current.status !== 'PENDING') return current.status;

      if (remote.status === 0) {
        if (remote.amount !== undefined && Number(remote.amount) !== payment.amount) {
          this.logger.error(`Montant incohérent pour le paiement ${paymentId} : attendu ${payment.amount}, reçu ${remote.amount}.`);
          await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED', note: 'Montant confirmé incohérent — vérification manuelle requise' } });
          return 'FAILED';
        }
        await tx.payment.update({
          where: { id: paymentId },
          data: { status: 'CONFIRMED', confirmedAt: new Date(), externalReference: remote.paymentReference ?? remote.txReference ?? payment.externalReference },
        });
        await this.payments.refreshTotals(tx, { orderId: payment.orderId! });
        await this.audit.log({ action: 'payment.online.confirmed', entity: 'Payment', entityId: paymentId, summary: `Paiement en ligne confirmé par PayGate : ${payment.amount} XOF` }, tx);
        return 'CONFIRMED';
      }
      if (remote.status === 4 || remote.status === 6) {
        await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED', note: remote.status === 4 ? 'Délai expiré' : 'Annulé par le client' } });
        return 'FAILED';
      }
      return 'PENDING';
    });
  }
}
