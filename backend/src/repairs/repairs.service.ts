import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentKind, PaymentMethod, Prisma, RepairStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { nextYearlyNumber } from '../common/counters';
import { CryptoService, normalizeIdentifier } from '../common/crypto.service';
import { computeRepairFinancials } from '../common/money';
import { cleanOptional } from '../common/text';
import { CustomersService } from '../customers/customers.module';
import { StockService } from '../inventory/stock.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { canTransitionRepair, DONE_STATUSES, isRepairClosed, QUOTABLE_STATUSES, REPAIR_STATUS_LABELS } from './repair-rules';

export interface CreateRepairInput {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  brandName: string;
  phoneModelId?: string | null;
  modelName: string;
  imei?: string | null;
  repairTypeId?: string | null;
  reportedIssue: string;
  technicianId?: string | null;
  dueAt?: string | null;
  billedAmount?: number;
  internalNotes?: string | null;
  requestId?: string;
}

export interface UpdateRepairInput {
  brandName?: string;
  phoneModelId?: string | null;
  modelName?: string;
  imei?: string | null;
  repairTypeId?: string | null;
  reportedIssue?: string;
  diagnosis?: string | null;
  workDone?: string | null;
  technicianId?: string | null;
  dueAt?: string | null;
  billedAmount?: number;
  consumablesCost?: number;
  otherDirectCosts?: number;
  otherCostsNote?: string | null;
  internalNotes?: string | null;
}

export const repairDetailInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  technician: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  phoneModel: { select: { id: true, name: true, brandId: true } },
  repairType: { select: { id: true, name: true } },
  parts: { orderBy: { createdAt: 'asc' as const }, include: { addedBy: { select: { name: true } } } },
  quotes: { orderBy: { version: 'asc' as const }, include: { createdBy: { select: { name: true } } } },
  history: { orderBy: { createdAt: 'desc' as const }, include: { user: { select: { name: true } } } },
  payments: { orderBy: { createdAt: 'asc' as const }, include: { recordedBy: { select: { name: true } } } },
  review: { select: { id: true, rating: true, status: true, createdAt: true } },
  request: { select: { id: true, reference: true } },
} satisfies Prisma.RepairJobInclude;

export type RepairDetail = Prisma.RepairJobGetPayload<{ include: typeof repairDetailInclude }>;


@Injectable()
export class RepairsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly payments: PaymentsService,
    private readonly customers: CustomersService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async get(id: string): Promise<RepairDetail> {
    const job = await this.prisma.repairJob.findUnique({ where: { id }, include: repairDetailInclude });
    if (!job) throw new NotFoundException('Dossier de réparation introuvable.');
    return job;
  }

  financials(job: Pick<RepairDetail, 'billedAmount' | 'parts' | 'consumablesCost' | 'otherDirectCosts'>) {
    return computeRepairFinancials(job);
  }

  /** Verrouille le dossier (sérialise les opérations concurrentes sur un même dossier). */
  private async lock(tx: Tx, id: string) {
    const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "RepairJob" WHERE "id" = ${id} FOR UPDATE`;
    if (!row) throw new NotFoundException('Dossier de réparation introuvable.');
    return tx.repairJob.findUniqueOrThrow({ where: { id } });
  }

  private history(tx: Tx, repairJobId: string, type: string, message: string, userId: string | null, from?: RepairStatus, to?: RepairStatus) {
    return tx.repairStatusHistory.create({ data: { repairJobId, type, message, userId, fromStatus: from, toStatus: to } });
  }

  private imeiFields(imei?: string | null) {
    if (!imei?.trim()) return { imeiEncrypted: null, imeiLast4: null };
    const normalized = normalizeIdentifier(imei);
    if (normalized.length < 8 || normalized.length > 20) throw new BadRequestException('IMEI ou numéro de série invalide.');
    return { imeiEncrypted: this.crypto.encrypt(normalized), imeiLast4: normalized.slice(-4) };
  }

  private async checkTechnician(tx: Tx, technicianId?: string | null) {
    if (!technicianId) return;
    const tech = await tx.user.findUnique({ where: { id: technicianId } });
    if (!tech || !tech.active) throw new BadRequestException('Réparateur introuvable ou inactif.');
  }

  async create(input: CreateRepairInput, userId: string) {
    const id = await this.prisma.run(async (tx) => {
      let customerId = input.customerId;
      if (customerId) {
        if (!(await tx.customer.findUnique({ where: { id: customerId } }))) throw new BadRequestException('Client introuvable.');
      } else {
        if (!input.customerPhone) throw new BadRequestException('Indiquez le téléphone du client.');
        customerId = (await this.customers.findOrCreate(tx, { name: input.customerName, phone: input.customerPhone })).id;
      }
      await this.checkTechnician(tx, input.technicianId);

      const job = await tx.repairJob.create({
        data: {
          number: await nextYearlyNumber(tx, 'R'),
          trackingCode: this.crypto.randomCode(8),
          customerId,
          brandName: input.brandName.trim(),
          phoneModelId: input.phoneModelId ?? null,
          modelName: input.modelName.trim(),
          ...this.imeiFields(input.imei),
          repairTypeId: input.repairTypeId ?? null,
          reportedIssue: input.reportedIssue.trim(),
          technicianId: input.technicianId ?? null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          billedAmount: input.billedAmount ?? 0,
          internalNotes: cleanOptional(input.internalNotes),
          createdById: userId,
        },
      });
      await this.history(tx, job.id, 'STATUS', 'Téléphone reçu en boutique', userId, undefined, 'RECEIVED');
      if (input.requestId) {
        const request = await tx.repairRequest.findUnique({ where: { id: input.requestId } });
        if (!request || request.repairJobId) throw new ConflictException('Cette demande a déjà été prise en charge.');
        await tx.repairRequest.update({ where: { id: input.requestId }, data: { status: 'CONVERTED', repairJobId: job.id, customerId } });
        await this.history(tx, job.id, 'NOTE', `Créé à partir de la demande en ligne ${request.reference}`, userId);
      }
      await this.audit.log({ userId, action: 'repair.create', entity: 'RepairJob', entityId: job.id, summary: `Dossier ${job.number} créé` }, tx);
      return job.id;
    });
    return this.get(id);
  }

  async update(id: string, input: UpdateRepairInput, userId: string) {
    await this.prisma.run(async (tx) => {
      const job = await this.lock(tx, id);
      const financialChange = input.billedAmount !== undefined || input.consumablesCost !== undefined || input.otherDirectCosts !== undefined;
      if (financialChange && isRepairClosed(job.status)) throw new ConflictException('Ce dossier est clos : ses montants ne peuvent plus être modifiés.');
      await this.checkTechnician(tx, input.technicianId);

      const data: Prisma.RepairJobUncheckedUpdateInput = {};
      if (input.brandName !== undefined) data.brandName = input.brandName.trim();
      if (input.modelName !== undefined) data.modelName = input.modelName.trim();
      if (input.phoneModelId !== undefined) data.phoneModelId = input.phoneModelId;
      if (input.repairTypeId !== undefined) data.repairTypeId = input.repairTypeId;
      if (input.reportedIssue !== undefined) data.reportedIssue = input.reportedIssue.trim();
      if (input.diagnosis !== undefined) data.diagnosis = cleanOptional(input.diagnosis);
      if (input.workDone !== undefined) data.workDone = cleanOptional(input.workDone);
      if (input.technicianId !== undefined) data.technicianId = input.technicianId;
      if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
      if (input.internalNotes !== undefined) data.internalNotes = cleanOptional(input.internalNotes);
      if (input.otherCostsNote !== undefined) data.otherCostsNote = cleanOptional(input.otherCostsNote);
      if (input.imei !== undefined) Object.assign(data, this.imeiFields(input.imei));
      if (input.consumablesCost !== undefined) data.consumablesCost = input.consumablesCost;
      if (input.otherDirectCosts !== undefined) data.otherDirectCosts = input.otherDirectCosts;

      const messages: string[] = [];
      if (input.billedAmount !== undefined && input.billedAmount !== job.billedAmount) {
        if (input.billedAmount < job.amountPaid) {
          throw new BadRequestException(`Le montant facturé ne peut pas être inférieur au montant déjà encaissé (${job.amountPaid} XOF).`);
        }
        data.billedAmount = input.billedAmount;
        await this.history(tx, id, 'PRICE', `Montant facturé : ${job.billedAmount} → ${input.billedAmount} XOF`, userId);
        messages.push('montant facturé');
      }
      if (input.consumablesCost !== undefined && input.consumablesCost !== job.consumablesCost) {
        await this.history(tx, id, 'COST', `Consommables : ${job.consumablesCost} → ${input.consumablesCost} XOF`, userId);
        messages.push('consommables');
      }
      if (input.otherDirectCosts !== undefined && input.otherDirectCosts !== job.otherDirectCosts) {
        await this.history(tx, id, 'COST', `Autres coûts directs : ${job.otherDirectCosts} → ${input.otherDirectCosts} XOF`, userId);
        messages.push('autres coûts');
      }
      if (input.diagnosis !== undefined && cleanOptional(input.diagnosis) !== job.diagnosis) {
        await this.history(tx, id, 'NOTE', 'Diagnostic mis à jour', userId);
      }
      if (input.imei !== undefined) await this.history(tx, id, 'NOTE', 'IMEI modifié', userId);

      await tx.repairJob.update({ where: { id }, data });
      if (input.billedAmount !== undefined) await this.payments.refreshTotals(tx, { repairJobId: id });
      if (messages.length) {
        await this.audit.log({ userId, action: 'repair.amounts', entity: 'RepairJob', entityId: id, summary: `Dossier ${job.number} : ${messages.join(', ')} modifié(s)` }, tx);
      }
    });
    return this.get(id);
  }

  async changeStatus(id: string, to: RepairStatus, note: string | undefined, userId: string) {
    await this.prisma.run(async (tx) => {
      const job = await this.lock(tx, id);
      if (!canTransitionRepair(job.status, to)) {
        throw new ConflictException(`Passage impossible de « ${REPAIR_STATUS_LABELS[job.status]} » à « ${REPAIR_STATUS_LABELS[to]} ».`);
      }
      const data: Prisma.RepairJobUpdateInput = { status: to };
      if (to === 'COMPLETED') data.completedAt = new Date();
      if (job.status === 'COMPLETED' && to === 'IN_PROGRESS') data.completedAt = null; // reprise
      if (to === 'PICKED_UP') data.deviceReturnedAt = job.deviceReturnedAt ?? new Date();
      if (to === 'CANCELLED') {
        if ((await this.payments.netPaid(tx, { repairJobId: id })) > 0) {
          throw new ConflictException("Des paiements ont été encaissés sur ce dossier : enregistrez d'abord le remboursement.");
        }
        data.cancelledAt = new Date();
        await tx.repairQuote.updateMany({ where: { repairJobId: id, status: 'PENDING' }, data: { status: 'SUPERSEDED' } });
      }
      await tx.repairJob.update({ where: { id }, data });
      const message = REPAIR_STATUS_LABELS[to] + (note?.trim() ? ` — ${note.trim()}` : '');
      await this.history(tx, id, 'STATUS', message, userId, job.status, to);
      await this.audit.log(
        { userId, action: 'repair.status', entity: 'RepairJob', entityId: id, summary: `Dossier ${job.number} : ${REPAIR_STATUS_LABELS[job.status]} → ${REPAIR_STATUS_LABELS[to]}` },
        tx,
      );
    });
    return this.get(id);
  }

  /** Remise du téléphone au client pour un dossier annulé (pour un dossier terminé : statut « récupéré »). */
  async markDeviceReturned(id: string, userId: string) {
    await this.prisma.run(async (tx) => {
      const job = await this.lock(tx, id);
      if (job.deviceReturnedAt) throw new ConflictException('Le téléphone a déjà été rendu.');
      if (job.status !== 'CANCELLED') throw new ConflictException('Pour une réparation terminée, utilisez le statut « Téléphone récupéré ».');
      await tx.repairJob.update({ where: { id }, data: { deviceReturnedAt: new Date() } });
      await this.history(tx, id, 'DEVICE', 'Téléphone rendu au client (dossier annulé)', userId);
    });
    return this.get(id);
  }

  // ─── Devis

  async createQuote(id: string, input: { amount: number; details: string; durationMinutes?: number | null }, userId: string) {
    await this.prisma.run(async (tx) => {
      const job = await this.lock(tx, id);
      if (!QUOTABLE_STATUSES.includes(job.status)) throw new ConflictException('Un devis ne peut plus être émis pour ce dossier.');
      const last = await tx.repairQuote.findFirst({ where: { repairJobId: id }, orderBy: { version: 'desc' } });
      await tx.repairQuote.updateMany({ where: { repairJobId: id, status: 'PENDING' }, data: { status: 'SUPERSEDED' } });
      const version = (last?.version ?? 0) + 1;
      await tx.repairQuote.create({
        data: { repairJobId: id, version, amount: input.amount, details: input.details.trim(), durationMinutes: input.durationMinutes ?? null, createdById: userId },
      });
      await tx.repairJob.update({ where: { id }, data: { status: 'QUOTE_PENDING' } });
      await this.history(tx, id, 'QUOTE', `Devis n°${version} émis : ${input.amount} XOF`, userId, job.status, 'QUOTE_PENDING');
    });
    return this.get(id);
  }

  /**
   * Décision sur un devis (client en ligne ou accord recueilli par l'équipe).
   * Accepté : le montant facturé prend la valeur du devis. Refusé : retour en diagnostic.
   */
  async decideQuote(id: string, quoteId: string, accept: boolean, via: 'CUSTOMER' | 'STAFF', userId: string | null) {
    await this.prisma.run(async (tx) => {
      const job = await this.lock(tx, id);
      const quote = await tx.repairQuote.findFirst({ where: { id: quoteId, repairJobId: id } });
      if (!quote) throw new NotFoundException('Devis introuvable.');
      if (quote.status !== 'PENDING' || job.status !== 'QUOTE_PENDING') throw new ConflictException("Ce devis n'est plus en attente de décision.");
      if (accept && quote.amount < job.amountPaid) throw new ConflictException('Le devis est inférieur au montant déjà encaissé.');

      await tx.repairQuote.update({ where: { id: quoteId }, data: { status: accept ? 'ACCEPTED' : 'REFUSED', decidedAt: new Date(), decidedVia: via } });
      const to: RepairStatus = accept ? 'QUOTE_ACCEPTED' : 'DIAGNOSING';
      await tx.repairJob.update({ where: { id }, data: { status: to, ...(accept ? { billedAmount: quote.amount } : {}) } });
      const who = via === 'CUSTOMER' ? 'par le client (en ligne)' : 'par le client (en boutique)';
      await this.history(tx, id, 'QUOTE', `Devis n°${quote.version} ${accept ? 'accepté' : 'refusé'} ${who}`, userId, job.status, to);
      if (accept && quote.amount !== job.billedAmount) {
        await this.history(tx, id, 'PRICE', `Montant facturé : ${job.billedAmount} → ${quote.amount} XOF (devis n°${quote.version})`, userId);
      }
      if (accept) await this.payments.refreshTotals(tx, { repairJobId: id });
      await this.audit.log(
        { userId, action: accept ? 'repair.quote.accept' : 'repair.quote.refuse', entity: 'RepairJob', entityId: id, summary: `Dossier ${job.number} : devis n°${quote.version} ${accept ? 'accepté' : 'refusé'} ${who}` },
        tx,
      );
    });
    return this.get(id);
  }

  // ─── Pièces

  /**
   * Ajout d'une pièce. Une pièce du stock quitte le stock immédiatement (mouvement REPAIR_USE)
   * et son coût est figé au coût moyen du moment.
   */
  async addPart(
    id: string,
    input: { source: 'STOCK' | 'EXTERNAL'; productId?: string; label?: string; quantity: number; unitCost?: number },
    userId: string,
  ) {
    await this.prisma.run(async (tx) => {
      const job = await this.lock(tx, id);
      if (isRepairClosed(job.status)) throw new ConflictException('Ce dossier est clos : aucune pièce ne peut être ajoutée.');

      if (input.source === 'STOCK') {
        if (!input.productId) throw new BadRequestException('Choisissez la pièce dans le stock.');
        const product = await tx.product.findUnique({ where: { id: input.productId } });
        if (!product || product.status !== 'ACTIVE') throw new BadRequestException('Pièce introuvable ou archivée.');
        const part = await tx.repairPart.create({
          data: { repairJobId: id, source: 'STOCK', productId: product.id, label: product.name, sku: product.sku, quantity: input.quantity, unitCost: 0, totalCost: 0, addedById: userId },
        });
        const unitCost = await this.stock.issue(tx, {
          productId: product.id,
          quantity: input.quantity,
          type: 'REPAIR_USE',
          repairPartId: part.id,
          reason: `Réparation ${job.number}`,
          userId,
        });
        await tx.repairPart.update({ where: { id: part.id }, data: { unitCost, totalCost: unitCost * input.quantity } });
        await this.history(tx, id, 'PART', `Pièce utilisée : ${input.quantity} × ${product.name} (${product.sku})`, userId);
      } else {
        if (!input.label?.trim()) throw new BadRequestException('Indiquez la désignation de la pièce.');
        if (input.unitCost === undefined) throw new BadRequestException("Indiquez le coût d'achat de la pièce.");
        await tx.repairPart.create({
          data: {
            repairJobId: id,
            source: 'EXTERNAL',
            label: input.label.trim(),
            quantity: input.quantity,
            unitCost: input.unitCost,
            totalCost: input.unitCost * input.quantity,
            addedById: userId,
          },
        });
        await this.history(tx, id, 'PART', `Pièce achetée hors stock : ${input.quantity} × ${input.label.trim()}`, userId);
      }
    });
    return this.get(id);
  }

  /**
   * Retrait d'une pièce (non posée, erreur de saisie). La ligne est conservée avec le statut RETURNED
   * et n'est plus comptée dans les coûts ; une pièce du stock y retourne à son coût figé.
   */
  async returnPart(id: string, partId: string, note: string, userId: string) {
    await this.prisma.run(async (tx) => {
      const job = await this.lock(tx, id);
      if (job.status === 'PICKED_UP') throw new ConflictException('Ce dossier est clos.');
      const part = await tx.repairPart.findFirst({ where: { id: partId, repairJobId: id } });
      if (!part) throw new NotFoundException('Pièce introuvable.');
      if (part.status === 'RETURNED') throw new ConflictException('Cette pièce a déjà été retirée.');
      await tx.repairPart.update({ where: { id: partId }, data: { status: 'RETURNED', returnedAt: new Date(), returnNote: note } });
      if (part.source === 'STOCK' && part.productId) {
        await this.stock.receive(tx, {
          productId: part.productId,
          quantity: part.quantity,
          unitCost: part.unitCost,
          type: 'REPAIR_RETURN',
          repairPartId: part.id,
          reason: `Retrait de la réparation ${job.number} : ${note}`,
          userId,
        });
      }
      await this.history(tx, id, 'PART', `Pièce retirée : ${part.quantity} × ${part.label} — ${note}`, userId);
    });
    return this.get(id);
  }

  // ─── Paiements

  async recordPayment(
    id: string,
    input: { kind: PaymentKind; amount: number; method: PaymentMethod; externalReference?: string; note?: string },
    userId: string,
  ) {
    await this.prisma.run(async (tx) => {
      const payment = await this.payments.recordManual(tx, { target: { repairJobId: id }, ...input, userId });
      await this.history(tx, id, 'PAYMENT', `${input.kind === 'PAYMENT' ? 'Paiement' : 'Remboursement'} de ${payment.amount} XOF`, userId);
    });
    return this.get(id);
  }

  async revealImei(id: string, userId: string) {
    const job = await this.prisma.repairJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Dossier introuvable.');
    if (!job.imeiEncrypted) return { imei: null };
    await this.audit.log({ userId, action: 'repair.imei.read', entity: 'RepairJob', entityId: id, summary: `Consultation de l'IMEI du dossier ${job.number}` });
    return { imei: this.crypto.decrypt(job.imeiEncrypted) };
  }
}
