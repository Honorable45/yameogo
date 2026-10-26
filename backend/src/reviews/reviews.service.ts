import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService, ReviewStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { CryptoService } from '../common/crypto.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { DONE_STATUSES } from '../repairs/repair-rules';

export interface ReviewInput {
  rating: number;
  ratingRepair?: number;
  ratingWelcome?: number;
  ratingValue?: number;
  comment?: string;
  displayName?: string;
  code: string;
}

/** Ce que concerne un code d'avis : un dossier de réparation ou une vente. */
export type ReviewTarget = { kind: 'repair'; id: string } | { kind: 'order'; id: string };

export const SERVICE_LABELS: Record<ReviewService, string> = {
  REPAIR: 'Réparation',
  ACCESSORY_PURCHASE: "Achat d'accessoires",
  PHONE_PURCHASE: "Achat d'un téléphone",
  OTHER: 'Autre',
};

const CODE_ERROR = 'Ce code est invalide, expiré ou déjà utilisé.';
/** Durée de validité d'un code : large, le client donne souvent son avis plusieurs semaines après. */
const REVIEW_CODE_DAYS = 180;

/**
 * Avis clients.
 * - Un avis n'est possible qu'avec un code, généré automatiquement pour chaque réparation et chaque vente
 *   (affiché dans l'administration, remis au client). Un code ne sert qu'une fois ; un dossier ou une vente
 *   ne reçoit qu'un avis.
 * - Le code n'est utilisable qu'une fois la réparation terminée ou la vente conclue.
 * - L'avis est publié immédiatement ; la boutique peut ensuite le masquer s'il est abusif.
 * - Le contenu d'un avis n'est jamais modifié.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  // ─── Codes (administration)

  /** Code actif du dossier ou de la vente ; créé s'il n'en existe pas encore. */
  async currentCode(target: ReviewTarget, userId: string) {
    return this.prisma.run(async (tx) => {
      const state = await this.lockTarget(tx, target);
      if (state.review) return this.codeInfo(state, null, null);
      const active = await tx.reviewVerificationToken.findFirst({
        where: { ...this.targetWhere(target), revokedAt: null, usedAt: null, expiresAt: { gt: new Date() }, codeEncrypted: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      if (active) return this.codeInfo(state, this.crypto.decrypt(active.codeEncrypted!), active.expiresAt);
      const created = await this.issue(tx, target, userId);
      return this.codeInfo(state, created.code, created.expiresAt);
    });
  }

  /** Nouveau code (l'ancien est révoqué) : code perdu ou communiqué par erreur. */
  async regenerateCode(target: ReviewTarget, userId: string) {
    return this.prisma.run(async (tx) => {
      const state = await this.lockTarget(tx, target);
      if (state.review) throw new ConflictException('Un avis a déjà été donné : aucun nouveau code n’est nécessaire.');
      const created = await this.issue(tx, target, userId);
      await this.audit.log({ userId, action: 'review.code.regenerate', entity: target.kind === 'repair' ? 'RepairJob' : 'Order', entityId: target.id, summary: `Nouveau code d'avis pour ${state.label}` }, tx);
      return this.codeInfo(state, created.code, created.expiresAt);
    });
  }

  private async issue(tx: Tx, target: ReviewTarget, userId: string) {
    await tx.reviewVerificationToken.updateMany({ where: { ...this.targetWhere(target), revokedAt: null, usedAt: null }, data: { revokedAt: new Date() } });
    const code = this.crypto.randomCode(8);
    const expiresAt = new Date(Date.now() + REVIEW_CODE_DAYS * 86400_000);
    await tx.reviewVerificationToken.create({
      data: { ...this.targetWhere(target), codeHash: this.crypto.hmac(code, 'review'), codeEncrypted: this.crypto.encrypt(code), createdById: userId, expiresAt },
    });
    return { code, expiresAt };
  }

  private codeInfo(state: TargetState, code: string | null, expiresAt: Date | null) {
    return {
      code,
      expiresAt,
      // Le client peut l'utiliser dès maintenant, ou seulement plus tard (réparation en cours…).
      usable: state.done,
      waitingFor: state.done ? null : state.waitingFor,
      review: state.review,
    };
  }

  private targetWhere(target: ReviewTarget) {
    return target.kind === 'repair' ? { repairJobId: target.id } : { orderId: target.id };
  }

  /** Verrouille le dossier ou la vente (codes créés une seule fois même en cas d'appels simultanés). */
  private async lockTarget(tx: Tx, target: ReviewTarget): Promise<TargetState> {
    const review = { select: { id: true, rating: true, createdAt: true, status: true } } as const;
    if (target.kind === 'repair') {
      const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "RepairJob" WHERE "id" = ${target.id} FOR UPDATE`;
      if (!row) throw new NotFoundException('Réparation introuvable.');
      const job = await tx.repairJob.findUniqueOrThrow({ where: { id: target.id }, select: { number: true, status: true, review } });
      return { label: `la réparation ${job.number}`, done: DONE_STATUSES.includes(job.status), waitingFor: 'la fin de la réparation', review: job.review };
    }
    const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Order" WHERE "id" = ${target.id} FOR UPDATE`;
    if (!row) throw new NotFoundException('Vente introuvable.');
    const order = await tx.order.findUniqueOrThrow({ where: { id: target.id }, select: { number: true, status: true, review } });
    if (order.status === 'CANCELLED') throw new ConflictException('Vente annulée : pas de code d’avis.');
    return { label: `la vente ${order.number}`, done: order.status === 'COMPLETED', waitingFor: 'la remise de la commande', review: order.review };
  }

  // ─── Avis (public)

  private async findToken(code: string) {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length < 8 || normalized.length > 16) throw new BadRequestException(CODE_ERROR);
    const token = await this.prisma.reviewVerificationToken.findUnique({
      where: { codeHash: this.crypto.hmac(normalized, 'review') },
      include: {
        repairJob: { select: { id: true, status: true, brandName: true, modelName: true } },
        order: { select: { id: true, status: true, items: { select: { label: true, usedPhoneId: true } } } },
      },
    });
    if (!token || token.revokedAt || token.usedAt || token.expiresAt < new Date()) throw new BadRequestException(CODE_ERROR);
    if (token.repairJob && !DONE_STATUSES.includes(token.repairJob.status)) {
      throw new BadRequestException('Votre réparation n’est pas encore terminée : vous pourrez donner votre avis dès qu’elle le sera.');
    }
    if (token.order && token.order.status !== 'COMPLETED') {
      throw new BadRequestException('Votre commande n’est pas encore remise : vous pourrez donner votre avis dès réception.');
    }
    const serviceType: ReviewService = token.repairJob ? 'REPAIR' : token.order!.items.some((i) => i.usedPhoneId) ? 'PHONE_PURCHASE' : 'ACCESSORY_PURCHASE';
    const subject = token.repairJob
      ? `Réparation de votre ${token.repairJob.brandName} ${token.repairJob.modelName}`
      : `Achat : ${token.order!.items.map((i) => i.label).slice(0, 2).join(', ')}${token.order!.items.length > 2 ? '…' : ''}`;
    return { token, serviceType, subject };
  }

  /** Vérifie un code sans le consommer (affiche au client ce qu'il évalue). */
  async checkCode(code: string) {
    const { serviceType, subject } = await this.findToken(code);
    return { valid: true, serviceType, subject };
  }

  async submit(input: ReviewInput, ip: string | null) {
    const { token, serviceType } = await this.findToken(input.code);
    await this.prisma.run(async (tx) => {
      // Consommation atomique du code : une seule requête peut le marquer comme utilisé.
      const { count } = await tx.reviewVerificationToken.updateMany({
        where: { id: token.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (!count) throw new BadRequestException(CODE_ERROR);
      const target = token.repairJobId ? { repairJobId: token.repairJobId } : { orderId: token.orderId! };
      if (await tx.review.findFirst({ where: target })) throw new ConflictException('Un avis a déjà été donné avec ce code.');
      await tx.review.create({
        data: {
          ...target,
          rating: input.rating,
          ratingRepair: serviceType === 'REPAIR' ? (input.ratingRepair ?? null) : null,
          ratingWelcome: input.ratingWelcome ?? null,
          ratingValue: input.ratingValue ?? null,
          comment: input.comment?.trim() || null,
          displayName: input.displayName?.trim().slice(0, 40) || null,
          ipHash: ip ? this.crypto.hmac(ip, 'ip') : null,
          serviceType,
          verified: true,
          // Publié immédiatement : le code garantit qu'il s'agit d'un vrai client.
          status: 'PUBLISHED',
        },
      });
      if (token.repairJobId) {
        await tx.repairStatusHistory.create({ data: { repairJobId: token.repairJobId, type: 'REVIEW', message: 'Avis client reçu' } });
      }
    });
    return { published: true };
  }

  // ─── Gestion (administration)

  async moderate(id: string, status: ReviewStatus, note: string | undefined, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avis introuvable.');
    const updated = await this.prisma.review.update({
      where: { id },
      data: { status, moderatedAt: new Date(), moderatedById: userId, moderationNote: note?.trim() || null },
    });
    await this.audit.log({ userId, action: 'review.moderate', entity: 'Review', entityId: id, summary: `Avis ${review.status} → ${status}${note ? ` : ${note}` : ''}` });
    return updated;
  }

  async reply(id: string, reply: string | null, userId: string) {
    const updated = await this.prisma.review.update({ where: { id }, data: { shopReply: reply?.trim() || null } });
    await this.audit.log({ userId, action: 'review.reply', entity: 'Review', entityId: id, summary: reply ? 'Réponse publique ajoutée' : 'Réponse publique retirée' });
    return updated;
  }
}

interface TargetState {
  label: string;
  done: boolean;
  waitingFor: string;
  review: { id: string; rating: number; createdAt: Date; status: ReviewStatus } | null;
}
