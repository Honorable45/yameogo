import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PhoneCondition, PhoneGrade, Prisma, UsedPhoneStatus } from '@prisma/client';
import { presentImage } from '../catalog/presenters';
import { AuditService } from '../common/audit.service';
import { randomReference } from '../common/counters';
import { CryptoService, normalizeIdentifier } from '../common/crypto.service';
import { slugify } from '../common/text';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export const GRADE_LABELS: Record<PhoneGrade, string> = {
  LIKE_NEW: 'Comme neuf',
  VERY_GOOD: 'Très bon état',
  GOOD: 'Bon état',
  FAIR: 'État correct',
};

export const CONDITION_LABELS: Record<PhoneCondition, string> = {
  NEW: 'Neuf',
  IMPORTED: 'Venu',
  USED: 'Occasion',
};

export const PHONE_STATUS_LABELS: Record<UsedPhoneStatus, string> = {
  PENDING_CHECK: 'En attente de vérification',
  AVAILABLE: 'Disponible',
  RESERVED: 'Réservé',
  SOLD: 'Vendu',
  RETURNED: 'Retourné',
  ARCHIVED: 'Archivé',
};

/** Transitions manuelles autorisées. RESERVED et SOLD sont pilotés par les commandes. */
const MANUAL_TRANSITIONS: Partial<Record<UsedPhoneStatus, UsedPhoneStatus[]>> = {
  PENDING_CHECK: ['AVAILABLE', 'ARCHIVED'],
  AVAILABLE: ['PENDING_CHECK', 'ARCHIVED'],
  RETURNED: ['PENDING_CHECK', 'AVAILABLE', 'ARCHIVED'],
  ARCHIVED: ['PENDING_CHECK'],
};

export interface UsedPhoneInput {
  brandId: string;
  phoneModelId?: string | null;
  modelName: string;
  condition?: PhoneCondition;
  storageGb?: number | null;
  ramGb?: number | null;
  color?: string | null;
  grade: PhoneGrade;
  batteryHealth?: number | null;
  knownDefects?: string | null;
  includedAccessories?: string | null;
  description?: string | null;
  purchasePrice: number;
  salePrice: number;
  warrantyMonths?: number;
  acquiredAt: string;
  acquiredFrom?: string | null;
  supplierId?: string | null;
  imei?: string | null;
  confirmDuplicate?: boolean;
}

const include = {
  brand: { select: { id: true, name: true, slug: true } },
  phoneModel: { select: { id: true, name: true } },
  images: { orderBy: { position: 'asc' as const } },
  supplier: { select: { id: true, name: true } },
} satisfies Prisma.UsedPhoneInclude;

type PhoneRow = Prisma.UsedPhoneGetPayload<{ include: typeof include }>;

@Injectable()
export class UsedPhonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Titre commercial : « iPhone 12 · 128 Go · Bleu » */
  static title(p: { brand?: { name: string }; modelName: string; storageGb: number | null; color: string | null }) {
    return [p.modelName, p.storageGb ? `${p.storageGb} Go` : null, p.color].filter(Boolean).join(' · ');
  }

  presentPublic(p: PhoneRow) {
    return {
      id: p.id,
      slug: p.slug,
      reference: p.reference,
      brand: p.brand,
      modelName: p.modelName,
      condition: p.condition,
      conditionLabel: CONDITION_LABELS[p.condition],
      title: UsedPhonesService.title(p),
      storageGb: p.storageGb,
      ramGb: p.ramGb,
      color: p.color,
      grade: p.grade,
      gradeLabel: GRADE_LABELS[p.grade],
      batteryHealth: p.batteryHealth,
      knownDefects: p.knownDefects,
      includedAccessories: p.includedAccessories,
      description: p.description,
      price: p.salePrice,
      warrantyMonths: p.warrantyMonths,
      status: p.status === 'RESERVED' ? 'RESERVED' : 'AVAILABLE',
      images: p.images.map((i) => presentImage(this.storage, i)),
      isDemo: p.isDemo,
    };
  }

  presentAdmin(p: PhoneRow, withCosts: boolean) {
    const { imeiEncrypted: _e, imeiHash: _h, ...rest } = p;
    return {
      ...rest,
      title: UsedPhonesService.title(p),
      gradeLabel: GRADE_LABELS[p.grade],
      conditionLabel: CONDITION_LABELS[p.condition],
      hasImei: Boolean(p.imeiEncrypted),
      purchasePrice: withCosts ? p.purchasePrice : null,
      estimatedMargin: withCosts ? p.salePrice - p.purchasePrice : null,
      images: p.images.map((i) => presentImage(this.storage, i)),
    };
  }

  async getRow(id: string) {
    const phone = await this.prisma.usedPhone.findUnique({ where: { id }, include });
    if (!phone) throw new NotFoundException('Téléphone introuvable.');
    return phone;
  }

  async publicList(filters: { brand?: string; condition?: PhoneCondition; maxPrice?: number; minStorage?: number; order?: string }) {
    const where: Prisma.UsedPhoneWhereInput = { status: { in: ['AVAILABLE', 'RESERVED'] }, condition: filters.condition };
    if (filters.brand) where.brand = { slug: filters.brand };
    if (filters.maxPrice) where.salePrice = { lte: filters.maxPrice };
    if (filters.minStorage) where.storageGb = { gte: filters.minStorage };
    const orderBy: Prisma.UsedPhoneOrderByWithRelationInput =
      filters.order === 'price_asc' ? { salePrice: 'asc' } : filters.order === 'price_desc' ? { salePrice: 'desc' } : { createdAt: 'desc' };
    const rows = await this.prisma.usedPhone.findMany({ where, include, orderBy: [{ status: 'asc' }, orderBy], take: 120 });
    return rows.map((p) => this.presentPublic(p));
  }

  async publicDetail(slug: string) {
    const phone = await this.prisma.usedPhone.findFirst({ where: { slug, status: { in: ['AVAILABLE', 'RESERVED'] } }, include });
    if (!phone) throw new NotFoundException("Ce téléphone n'est plus disponible.");
    return this.presentPublic(phone);
  }

  private imeiFields(imei?: string | null) {
    if (!imei?.trim()) return { imeiEncrypted: null, imeiHash: null, imeiLast4: null };
    const normalized = normalizeIdentifier(imei);
    if (normalized.length < 8 || normalized.length > 20) throw new BadRequestException('IMEI ou numéro de série invalide.');
    return {
      imeiEncrypted: this.crypto.encrypt(normalized),
      imeiHash: this.crypto.hmac(normalized, 'imei'),
      imeiLast4: normalized.slice(-4),
    };
  }

  /** Protection contre les doublons : IMEI identique (bloquant) ou fiche très similaire récente (confirmation requise). */
  private async checkDuplicates(tx: Tx, input: UsedPhoneInput, imeiHash: string | null, excludeId?: string) {
    if (imeiHash) {
      const same = await tx.usedPhone.findUnique({ where: { imeiHash } });
      if (same && same.id !== excludeId) {
        throw new ConflictException(`Cet IMEI est déjà enregistré (fiche ${same.reference}).`);
      }
    }
    if (!excludeId && !input.confirmDuplicate) {
      const similar = await tx.usedPhone.findFirst({
        where: {
          brandId: input.brandId,
          modelName: { equals: input.modelName.trim(), mode: 'insensitive' },
          storageGb: input.storageGb ?? null,
          color: input.color ? { equals: input.color.trim(), mode: 'insensitive' } : null,
          status: { notIn: ['SOLD', 'ARCHIVED'] },
          createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
      });
      if (similar) {
        throw new ConflictException({
          code: 'POSSIBLE_DUPLICATE',
          message: `Une fiche très proche existe déjà (${similar.reference}). Confirmez qu'il s'agit d'un autre appareil.`,
          existing: { id: similar.id, reference: similar.reference },
        });
      }
    }
  }

  private async checkModel(tx: Tx, brandId: string, modelId?: string | null) {
    const brand = await tx.brand.findUnique({ where: { id: brandId } });
    if (!brand) throw new BadRequestException('Marque introuvable.');
    if (modelId) {
      const model = await tx.phoneModel.findUnique({ where: { id: modelId } });
      if (!model || model.brandId !== brandId) throw new BadRequestException('Le modèle ne correspond pas à la marque.');
    }
    return brand;
  }

  async create(input: UsedPhoneInput, userId: string) {
    const id = await this.prisma.run(async (tx) => {
      const brand = await this.checkModel(tx, input.brandId, input.phoneModelId);
      const imei = this.imeiFields(input.imei);
      await this.checkDuplicates(tx, input, imei.imeiHash);
      const reference = await randomReference('TEL', async (r) => Boolean(await tx.usedPhone.findUnique({ where: { reference: r }, select: { id: true } })));
      const phone = await tx.usedPhone.create({
        data: {
          reference,
          slug: `${slugify(`${brand.name} ${input.modelName} ${input.storageGb ? `${input.storageGb}go` : ''}`)}-${reference.toLowerCase()}`,
          brandId: input.brandId,
          phoneModelId: input.phoneModelId ?? null,
          modelName: input.modelName.trim(),
          condition: input.condition ?? 'USED',
          storageGb: input.storageGb ?? null,
          ramGb: input.ramGb ?? null,
          color: input.color?.trim() || null,
          // Un téléphone neuf n'a pas d'usure : état « comme neuf », batterie non évaluée.
          grade: input.condition === 'NEW' ? 'LIKE_NEW' : input.grade,
          batteryHealth: input.condition === 'NEW' ? null : (input.batteryHealth ?? null),
          knownDefects: input.knownDefects?.trim() || null,
          includedAccessories: input.includedAccessories?.trim() || null,
          description: input.description?.trim() || null,
          purchasePrice: input.purchasePrice,
          salePrice: input.salePrice,
          warrantyMonths: input.warrantyMonths ?? 0,
          acquiredAt: new Date(input.acquiredAt),
          acquiredFrom: input.acquiredFrom?.trim() || null,
          supplierId: input.supplierId ?? null,
          ...imei,
        },
      });
      await tx.usedPhoneEvent.create({
        data: { usedPhoneId: phone.id, type: 'CREATED', toStatus: 'PENDING_CHECK', message: `Fiche créée — prix d'achat enregistré`, userId },
      });
      await this.audit.log({ userId, action: 'usedPhone.create', entity: 'UsedPhone', entityId: phone.id, summary: `Téléphone ${reference} enregistré` }, tx);
      return phone.id;
    });
    return this.getRow(id);
  }

  async update(id: string, input: Partial<UsedPhoneInput>, userId: string) {
    await this.prisma.run(async (tx) => {
      const current = await tx.usedPhone.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Téléphone introuvable.');
      if (current.status === 'SOLD' && (input.purchasePrice !== undefined || input.salePrice !== undefined)) {
        throw new ConflictException("Les prix d'un téléphone vendu ne peuvent plus être modifiés.");
      }
      if (input.brandId || input.phoneModelId) await this.checkModel(tx, input.brandId ?? current.brandId, input.phoneModelId ?? current.phoneModelId);

      const data: Prisma.UsedPhoneUncheckedUpdateInput = {};
      const simple = ['brandId', 'phoneModelId', 'condition', 'storageGb', 'ramGb', 'grade', 'batteryHealth', 'purchasePrice', 'salePrice', 'warrantyMonths', 'supplierId'] as const;
      for (const key of simple) if (input[key] !== undefined) (data as Record<string, unknown>)[key] = input[key];
      const texts = ['modelName', 'color', 'knownDefects', 'includedAccessories', 'description', 'acquiredFrom'] as const;
      for (const key of texts) if (input[key] !== undefined) (data as Record<string, unknown>)[key] = input[key]?.trim() || null;
      if (input.acquiredAt) data.acquiredAt = new Date(input.acquiredAt);
      if (input.imei !== undefined) {
        const imei = this.imeiFields(input.imei);
        await this.checkDuplicates(tx, { ...current, ...input } as UsedPhoneInput, imei.imeiHash, id);
        Object.assign(data, imei);
      }
      await tx.usedPhone.update({ where: { id }, data });

      const changes: string[] = [];
      if (input.salePrice !== undefined && input.salePrice !== current.salePrice) changes.push(`prix de vente ${current.salePrice} → ${input.salePrice} XOF`);
      if (input.purchasePrice !== undefined && input.purchasePrice !== current.purchasePrice) changes.push(`prix d'achat modifié`);
      if (input.imei !== undefined) changes.push('IMEI modifié');
      await tx.usedPhoneEvent.create({
        data: { usedPhoneId: id, type: 'UPDATED', message: changes.length ? `Fiche modifiée : ${changes.join(', ')}` : 'Fiche modifiée', userId },
      });
      if (changes.length) {
        await this.audit.log({ userId, action: 'usedPhone.update', entity: 'UsedPhone', entityId: id, summary: `${current.reference} : ${changes.join(', ')}` }, tx);
      }
    });
    return this.getRow(id);
  }

  async changeStatus(id: string, to: UsedPhoneStatus, note: string | undefined, userId: string) {
    await this.prisma.run(async (tx) => {
      const phone = await this.lock(tx, id);
      if (!MANUAL_TRANSITIONS[phone.status]?.includes(to)) {
        throw new ConflictException(`Passage impossible de « ${PHONE_STATUS_LABELS[phone.status]} » à « ${PHONE_STATUS_LABELS[to]} ».`);
      }
      if (to === 'AVAILABLE') {
        const images = await tx.usedPhoneImage.count({ where: { usedPhoneId: id } });
        if (!images) throw new BadRequestException('Ajoutez au moins une photo réelle avant de mettre le téléphone en vente.');
      }
      await tx.usedPhone.update({ where: { id }, data: { status: to } });
      await tx.usedPhoneEvent.create({
        data: { usedPhoneId: id, type: 'STATUS', fromStatus: phone.status, toStatus: to, message: note?.trim() || PHONE_STATUS_LABELS[to], userId },
      });
    });
    return this.getRow(id);
  }

  async revealImei(id: string, userId: string) {
    const phone = await this.prisma.usedPhone.findUnique({ where: { id } });
    if (!phone) throw new NotFoundException('Téléphone introuvable.');
    if (!phone.imeiEncrypted) return { imei: null };
    await this.audit.log({ userId, action: 'usedPhone.imei.read', entity: 'UsedPhone', entityId: id, summary: `Consultation de l'IMEI de ${phone.reference}` });
    return { imei: this.crypto.decrypt(phone.imeiEncrypted) };
  }

  // ─── Opérations pilotées par les commandes

  async lock(tx: Tx, id: string) {
    const rows = await tx.$queryRaw<{ id: string; status: UsedPhoneStatus; reference: string; purchasePrice: number; salePrice: number }[]>`
      SELECT "id", "status", "reference", "purchasePrice", "salePrice" FROM "UsedPhone" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Téléphone introuvable.');
    return rows[0];
  }

  async reserve(tx: Tx, id: string, orderNumber: string, userId?: string | null) {
    const phone = await this.lock(tx, id);
    if (phone.status !== 'AVAILABLE') throw new ConflictException(`Le téléphone ${phone.reference} n'est plus disponible.`);
    await tx.usedPhone.update({ where: { id }, data: { status: 'RESERVED' } });
    await tx.usedPhoneEvent.create({
      data: { usedPhoneId: id, type: 'ORDER', fromStatus: 'AVAILABLE', toStatus: 'RESERVED', message: `Réservé par la commande ${orderNumber}`, userId: userId ?? null },
    });
  }

  async release(tx: Tx, id: string, orderNumber: string, userId?: string | null) {
    const phone = await this.lock(tx, id);
    if (phone.status !== 'RESERVED') return;
    await tx.usedPhone.update({ where: { id }, data: { status: 'AVAILABLE' } });
    await tx.usedPhoneEvent.create({
      data: { usedPhoneId: id, type: 'ORDER', fromStatus: 'RESERVED', toStatus: 'AVAILABLE', message: `Remis en vente (commande ${orderNumber} annulée)`, userId: userId ?? null },
    });
  }

  /** Vente : renvoie le prix d'achat, utilisé comme coût de la vente. */
  async markSold(tx: Tx, id: string, orderNumber: string, fromReservation: boolean, userId?: string | null) {
    const phone = await this.lock(tx, id);
    const expected = fromReservation ? 'RESERVED' : 'AVAILABLE';
    if (phone.status !== expected) throw new ConflictException(`Le téléphone ${phone.reference} n'est pas disponible à la vente.`);
    await tx.usedPhone.update({ where: { id }, data: { status: 'SOLD', soldAt: new Date() } });
    await tx.usedPhoneEvent.create({
      data: { usedPhoneId: id, type: 'SALE', fromStatus: phone.status, toStatus: 'SOLD', message: `Vendu (commande ${orderNumber})`, userId: userId ?? null },
    });
    return phone.purchasePrice;
  }

  async markReturned(tx: Tx, id: string, orderNumber: string, reason: string, userId: string) {
    const phone = await this.lock(tx, id);
    if (phone.status !== 'SOLD') throw new ConflictException(`Le téléphone ${phone.reference} n'est pas indiqué comme vendu.`);
    await tx.usedPhone.update({ where: { id }, data: { status: 'RETURNED', soldAt: null } });
    await tx.usedPhoneEvent.create({
      data: { usedPhoneId: id, type: 'RETURN', fromStatus: 'SOLD', toStatus: 'RETURNED', message: `Retour client (commande ${orderNumber}) : ${reason}`, userId },
    });
  }

  // ─── Photos

  async addImage(id: string, file: Buffer, alt?: string) {
    const phone = await this.prisma.usedPhone.findUnique({ where: { id }, include: { _count: { select: { images: true } } } });
    if (!phone) throw new NotFoundException('Téléphone introuvable.');
    if (phone._count.images >= 10) throw new BadRequestException('10 photos maximum par téléphone.');
    const stored = await this.storage.savePublicImage(file, 'phones');
    return this.prisma.usedPhoneImage.create({
      data: { usedPhoneId: id, storageKey: stored.key, width: stored.width, height: stored.height, alt: alt?.trim() || phone.modelName, position: phone._count.images },
    });
  }

  async removeImage(id: string, imageId: string) {
    const image = await this.prisma.usedPhoneImage.findFirst({ where: { id: imageId, usedPhoneId: id } });
    if (!image) throw new NotFoundException('Photo introuvable.');
    await this.prisma.usedPhoneImage.delete({ where: { id: imageId } });
    if (image.storageKey) await this.storage.removePublicImage(image.storageKey);
  }
}
