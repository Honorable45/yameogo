import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PhoneCondition, Prisma, ProductKind } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { randomReference } from '../common/counters';
import { cleanOptional, slugify } from '../common/text';
import { StockService } from '../inventory/stock.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { availabilityOf, presentImage, variantLabel } from './presenters';

export interface VariantInput {
  id?: string;
  color?: string | null;
  colorHex?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  condition?: PhoneCondition | null;
  optionValue?: string | null;
  salePrice: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  lowStockThreshold?: number;
  active?: boolean;
  /** Stock souhaité : une hausse est une entrée valorisée, une baisse une correction tracée. */
  stock?: number;
  /** Coût d'achat unitaire des unités ajoutées (obligatoire pour une première entrée). */
  unitCost?: number;
}

export interface GroupInput {
  kind: ProductKind;
  name: string;
  brandId?: string | null;
  /** Marque saisie librement : créée si elle n'existe pas encore. */
  brandName?: string | null;
  categoryId: string;
  description?: string;
  specs?: { label: string; value: string }[];
  optionName?: string | null;
  compatibleWith?: string | null;
  published?: boolean;
  featured?: boolean;
  supplierId?: string | null;
  variants: VariantInput[];
}

const MAX_IMAGES = 12;

const adminInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true, kind: true } },
  images: { orderBy: { position: 'asc' } },
  variants: { orderBy: [{ status: 'asc' }, { position: 'asc' }], include: { supplier: { select: { id: true, name: true } } } },
} satisfies Prisma.ProductGroupInclude;

type AdminGroup = Prisma.ProductGroupGetPayload<{ include: typeof adminInclude }>;

/** Clé d'une configuration : deux variantes d'une même fiche ne peuvent pas la partager. */
const comboKey = (v: { color: string | null; ramGb: number | null; storageGb: number | null; condition: PhoneCondition | null; optionValue: string | null }) =>
  JSON.stringify([v.color?.toLowerCase() ?? null, v.ramGb, v.storageGb, v.condition, v.optionValue?.toLowerCase() ?? null]);

/**
 * Fiches produits (smartphones, accessoires) et leurs variantes.
 * Chaque variante est un article à part entière : prix, prix barré, stock (mouvements tracés, coût moyen), référence.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  // ─── Lecture

  present(g: AdminGroup, withCosts: boolean) {
    return {
      id: g.id,
      kind: g.kind,
      name: g.name,
      slug: g.slug,
      brand: g.brand,
      category: g.category,
      description: g.description,
      specs: Array.isArray(g.specs) ? g.specs : [],
      optionName: g.optionName,
      compatibleWith: g.compatibleWith,
      published: g.published,
      featured: g.featured,
      status: g.status,
      isDemo: g.isDemo,
      images: g.images.map((i) => presentImage(this.storage, i)),
      variants: g.variants.map((v) => {
        const { available, availability } = availabilityOf(v);
        return {
          id: v.id,
          sku: v.sku,
          label: variantLabel(v) || 'Modèle unique',
          color: v.color,
          colorHex: v.colorHex,
          ramGb: v.ramGb,
          storageGb: v.storageGb,
          condition: v.condition,
          optionValue: v.optionValue,
          salePrice: v.salePrice,
          compareAtPrice: v.compareAtPrice,
          averageCost: withCosts ? v.averageCost : null,
          stockQuantity: v.stockQuantity,
          reservedQuantity: v.reservedQuantity,
          available,
          availability,
          lowStockThreshold: v.lowStockThreshold,
          active: v.status === 'ACTIVE',
          supplier: v.supplier,
        };
      }),
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    };
  }

  async get(id: string, withCosts: boolean) {
    const g = await this.prisma.productGroup.findUnique({ where: { id }, include: adminInclude });
    if (!g) throw new NotFoundException('Produit introuvable.');
    return this.present(g, withCosts);
  }

  // ─── Enregistrement

  private async uniqueSlug(tx: Tx, name: string) {
    const base = slugify(name) || 'produit';
    let slug = base;
    for (let i = 2; await tx.productGroup.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    return slug;
  }

  /** Normalise les variantes saisies selon le type de produit et vérifie leur cohérence. */
  private normalizeVariants(kind: ProductKind, optionName: string | null, variants: VariantInput[]) {
    if (!variants.length) throw new BadRequestException('Ajoutez au moins une configuration (variante).');
    const seen = new Set<string>();
    return variants.map((v, index) => {
      const color = cleanOptional(v.color);
      const colorHex = color ? cleanOptional(v.colorHex)?.toLowerCase() ?? null : null;
      if (colorHex && !/^#[0-9a-f]{6}$/.test(colorHex)) throw new BadRequestException(`Ligne ${index + 1} : couleur de pastille invalide.`);
      const n = {
        ...v,
        color,
        colorHex,
        // Les accessoires n'ont ni mémoire ni état : ces options ne sont pas proposées.
        ramGb: kind === 'PHONE' ? (v.ramGb ?? null) : null,
        storageGb: kind === 'PHONE' ? (v.storageGb ?? null) : null,
        condition: kind === 'PHONE' ? (v.condition ?? null) : null,
        optionValue: optionName ? cleanOptional(v.optionValue) : null,
        compareAtPrice: v.compareAtPrice ?? null,
      };
      if (n.compareAtPrice !== null && n.compareAtPrice <= n.salePrice) {
        throw new BadRequestException(`Ligne ${index + 1} : le prix barré doit être supérieur au prix de vente.`);
      }
      if (optionName && !n.optionValue && variants.length > 1) throw new BadRequestException(`Ligne ${index + 1} : renseignez « ${optionName} ».`);
      const key = comboKey(n);
      if (seen.has(key)) throw new BadRequestException(`Ligne ${index + 1} : cette configuration existe déjà dans la liste.`);
      seen.add(key);
      return n;
    });
  }

  private async resolveRefs(tx: Tx, input: GroupInput) {
    const category = await tx.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new BadRequestException('Catégorie introuvable.');
    if (category.kind !== input.kind) throw new BadRequestException(input.kind === 'PHONE' ? 'Choisissez une catégorie de smartphones.' : "Choisissez une catégorie d'accessoires.");
    let brandId = input.brandId ?? null;
    const brandName = cleanOptional(input.brandName);
    if (!brandId && brandName) {
      const slug = slugify(brandName);
      if (!slug) throw new BadRequestException('Marque invalide.');
      brandId = (await tx.brand.upsert({ where: { slug }, update: {}, create: { name: brandName, slug } })).id;
    }
    if (brandId && !(await tx.brand.findUnique({ where: { id: brandId } }))) throw new BadRequestException('Marque introuvable.');
    if (input.kind === 'PHONE' && !brandId) throw new BadRequestException('Indiquez la marque du smartphone.');
    return { brandId };
  }

  async create(input: GroupInput, userId: string, withCosts: boolean) {
    const id = await this.prisma.run(async (tx) => {
      const { brandId } = await this.resolveRefs(tx, input);
      const optionName = cleanOptional(input.optionName);
      const variants = this.normalizeVariants(input.kind, optionName, input.variants);
      const group = await tx.productGroup.create({
        data: {
          kind: input.kind,
          name: input.name.trim(),
          slug: await this.uniqueSlug(tx, input.name),
          brandId,
          categoryId: input.categoryId,
          description: input.description?.trim() ?? '',
          specs: this.cleanSpecs(input.specs),
          optionName,
          compatibleWith: cleanOptional(input.compatibleWith),
          published: input.published ?? true,
          featured: input.featured ?? false,
        },
      });
      await this.saveVariants(tx, group, variants, input.supplierId ?? null, userId);
      await this.audit.log({ userId, action: 'group.create', entity: 'ProductGroup', entityId: group.id, summary: `Produit créé : ${group.name} (${variants.length} configuration(s))` }, tx);
      return group.id;
    });
    return this.get(id, withCosts);
  }

  async update(id: string, input: GroupInput, userId: string, withCosts: boolean) {
    await this.prisma.run(async (tx) => {
      const [row] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ProductGroup" WHERE "id" = ${id} FOR UPDATE`;
      if (!row) throw new NotFoundException('Produit introuvable.');
      const current = await tx.productGroup.findUniqueOrThrow({ where: { id } });
      if (current.kind !== input.kind) throw new BadRequestException('Le type de produit ne peut pas être modifié.');
      const { brandId } = await this.resolveRefs(tx, input);
      const optionName = cleanOptional(input.optionName);
      const variants = this.normalizeVariants(input.kind, optionName, input.variants);
      const group = await tx.productGroup.update({
        where: { id },
        data: {
          name: input.name.trim(),
          brandId,
          categoryId: input.categoryId,
          description: input.description?.trim() ?? '',
          specs: this.cleanSpecs(input.specs),
          optionName,
          compatibleWith: cleanOptional(input.compatibleWith),
          published: input.published ?? current.published,
          featured: input.featured ?? current.featured,
        },
      });
      await this.saveVariants(tx, group, variants, input.supplierId, userId);
    });
    return this.get(id, withCosts);
  }

  private cleanSpecs(specs: GroupInput['specs']) {
    return (specs ?? [])
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value)
      .slice(0, 40);
  }

  /** Crée, met à jour, archive ou supprime les variantes pour qu'elles correspondent à la liste saisie. */
  private async saveVariants(
    tx: Tx,
    group: { id: string; kind: ProductKind; name: string; slug: string; categoryId: string; published: boolean; isDemo: boolean },
    variants: ReturnType<GroupsService['normalizeVariants']>,
    supplierId: string | null | undefined,
    userId: string,
  ) {
    const existing = await tx.product.findMany({ where: { groupId: group.id } });
    const byId = new Map(existing.map((p) => [p.id, p]));
    const byCombo = new Map(existing.map((p) => [comboKey(p), p]));
    const kept = new Set<string>();

    for (const [position, v] of variants.entries()) {
      // Une configuration retirée puis saisie à nouveau réactive l'article d'origine (historique conservé).
      const current = v.id ? byId.get(v.id) : byCombo.get(comboKey(v));
      if (v.id && !current) throw new BadRequestException('Une configuration ne correspond pas à ce produit.');
      const label = variantLabel(v);
      const data = {
        kind: group.kind,
        categoryId: group.categoryId,
        name: label ? `${group.name} · ${label}` : group.name,
        color: v.color,
        colorHex: v.colorHex,
        ramGb: v.ramGb,
        storageGb: v.storageGb,
        condition: v.condition,
        optionValue: v.optionValue,
        salePrice: v.salePrice,
        compareAtPrice: v.compareAtPrice,
        lowStockThreshold: v.lowStockThreshold ?? current?.lowStockThreshold ?? 2,
        status: v.active === false ? ('ARCHIVED' as const) : ('ACTIVE' as const),
        published: group.published,
        position,
        ...(supplierId !== undefined ? { supplierId } : {}),
      };

      let productId: string;
      try {
        if (current) {
          kept.add(current.id);
          await tx.product.update({ where: { id: current.id }, data });
          productId = current.id;
          if (current.salePrice !== v.salePrice) {
            await this.audit.log(
              { userId, action: 'product.price', entity: 'Product', entityId: current.id, summary: `Prix modifié (${data.name}) : ${current.salePrice} → ${v.salePrice} XOF`, details: { before: current.salePrice, after: v.salePrice } },
              tx,
            );
          }
        } else {
          let sku = cleanOptional(v.sku)?.toUpperCase() ?? null;
          if (sku && (await tx.product.findUnique({ where: { sku } }))) throw new ConflictException(`La référence ${sku} existe déjà.`);
          sku ??= await randomReference(group.kind === 'PHONE' ? 'TEL' : 'ACC', async (r) => Boolean(await tx.product.findUnique({ where: { sku: r }, select: { id: true } })));
          const created = await tx.product.create({ data: { ...data, groupId: group.id, sku, slug: `${group.slug}-${sku.toLowerCase()}`, isDemo: group.isDemo } });
          kept.add(created.id);
          productId = created.id;
        }
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException(`La configuration « ${label || 'modèle unique'} » existe déjà pour ce produit.`);
        }
        throw err;
      }
      if (v.stock !== undefined) await this.setStock(tx, productId, v.stock, v.unitCost, current ? 'ADJUSTMENT' : 'INITIAL', userId);
    }

    // Configurations retirées de la liste : supprimées si elles n'ont aucun historique commercial, sinon archivées.
    for (const p of existing.filter((x) => !kept.has(x.id))) {
      if (await this.isDeletable(tx, p.id)) {
        await tx.inventoryMovement.deleteMany({ where: { productId: p.id } });
        await tx.product.delete({ where: { id: p.id } });
      } else if (p.status !== 'ARCHIVED') {
        await tx.product.update({ where: { id: p.id }, data: { status: 'ARCHIVED' } });
      }
    }
  }

  /** Amène le stock d'une variante à `target` : entrée valorisée (hausse) ou correction tracée (baisse). */
  private async setStock(tx: Tx, productId: string, target: number, unitCost: number | undefined, entry: 'INITIAL' | 'ADJUSTMENT', userId: string) {
    const p = await this.stock.lock(tx, productId);
    const delta = target - p.stockQuantity;
    if (delta === 0) return;
    if (delta > 0) {
      const cost = unitCost ?? (p.averageCost > 0 ? p.averageCost : undefined);
      if (cost === undefined) throw new BadRequestException(`${p.name} : indiquez le coût d'achat unitaire des unités ajoutées.`);
      await this.stock.receive(tx, {
        productId,
        quantity: delta,
        unitCost: cost,
        type: entry,
        reason: entry === 'INITIAL' ? 'Stock initial à la création de la configuration' : 'Entrée de stock depuis la fiche produit',
        userId,
      });
    } else {
      if (target < p.reservedQuantity) throw new ConflictException(`${p.name} : ${p.reservedQuantity} unité(s) sont réservées, le stock ne peut pas descendre en dessous.`);
      await this.stock.adjust(tx, { productId, delta, type: 'ADJUSTMENT', reason: 'Correction depuis la fiche produit', userId });
    }
  }

  /** Un article sans vente, approvisionnement ni inventaire peut être supprimé définitivement. */
  private async isDeletable(tx: Tx, productId: string) {
    const [orders, purchases, counts] = await Promise.all([
      tx.orderItem.count({ where: { productId } }),
      tx.purchaseItem.count({ where: { productId } }),
      tx.inventoryCountLine.count({ where: { productId } }),
    ]);
    return orders + purchases + counts === 0;
  }

  async setStatus(id: string, status: 'ACTIVE' | 'ARCHIVED', userId: string, withCosts: boolean) {
    const group = await this.prisma.productGroup.update({ where: { id }, data: { status } });
    await this.audit.log({ userId, action: status === 'ARCHIVED' ? 'group.archive' : 'group.restore', entity: 'ProductGroup', entityId: id, summary: `${status === 'ARCHIVED' ? 'Produit archivé' : 'Produit réactivé'} : ${group.name}` });
    return this.get(id, withCosts);
  }

  /** Suppression définitive, réservée aux produits jamais vendus ni approvisionnés (sinon : archivage). */
  async remove(id: string, userId: string) {
    const keys = await this.prisma.run(async (tx) => {
      const group = await tx.productGroup.findUnique({ where: { id }, include: { variants: { select: { id: true } }, images: true } });
      if (!group) throw new NotFoundException('Produit introuvable.');
      for (const v of group.variants) {
        if (!(await this.isDeletable(tx, v.id))) throw new ConflictException('Ce produit a déjà été vendu ou approvisionné : archivez-le pour conserver son historique.');
      }
      const ids = group.variants.map((v) => v.id);
      await tx.inventoryMovement.deleteMany({ where: { productId: { in: ids } } });
      await tx.product.deleteMany({ where: { id: { in: ids } } });
      await tx.productGroup.delete({ where: { id } });
      await this.audit.log({ userId, action: 'group.delete', entity: 'ProductGroup', entityId: id, summary: `Produit supprimé : ${group.name}` }, tx);
      return group.images.map((i) => i.storageKey).filter((k): k is string => Boolean(k));
    });
    for (const key of keys) await this.storage.removePublicImage(key);
  }

  // ─── Photos

  async addImage(groupId: string, file: Buffer, alt: string | undefined, color: string | undefined) {
    const group = await this.prisma.productGroup.findUnique({ where: { id: groupId }, include: { _count: { select: { images: true } } } });
    if (!group) throw new NotFoundException('Produit introuvable.');
    if (group._count.images >= MAX_IMAGES) throw new BadRequestException(`${MAX_IMAGES} photos maximum par produit.`);
    const stored = await this.storage.savePublicImage(file, 'products');
    const image = await this.prisma.productImage.create({
      data: { groupId, storageKey: stored.key, width: stored.width, height: stored.height, alt: alt?.trim() || group.name, color: cleanOptional(color), position: group._count.images },
    });
    return presentImage(this.storage, image);
  }

  async updateImage(groupId: string, imageId: string, data: { alt?: string; color?: string | null }) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, groupId } });
    if (!image) throw new NotFoundException('Photo introuvable.');
    const updated = await this.prisma.productImage.update({
      where: { id: imageId },
      data: { alt: data.alt !== undefined ? data.alt.trim() : undefined, color: data.color !== undefined ? cleanOptional(data.color) : undefined },
    });
    return presentImage(this.storage, updated);
  }

  async removeImage(groupId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, groupId } });
    if (!image) throw new NotFoundException('Photo introuvable.');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    if (image.storageKey) await this.storage.removePublicImage(image.storageKey);
  }

  async reorderImages(groupId: string, ids: string[]) {
    const images = await this.prisma.productImage.findMany({ where: { groupId } });
    if (images.length !== ids.length || !images.every((i) => ids.includes(i.id))) throw new BadRequestException("L'ordre transmis ne correspond pas aux photos du produit.");
    await this.prisma.$transaction(ids.map((id, position) => this.prisma.productImage.update({ where: { id }, data: { position } })));
  }
}
