import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductKind } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { randomReference } from '../common/counters';
import { cleanOptional, slugify } from '../common/text';
import { StockService } from '../inventory/stock.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { presentAdminProduct, productPublicInclude } from './presenters';

export interface CompatibilityInput {
  brandId: string;
  modelId?: string | null;
}

export interface ProductInput {
  kind?: ProductKind;
  name: string;
  sku?: string;
  description?: string;
  categoryId: string;
  supplierId?: string | null;
  salePrice: number;
  lowStockThreshold?: number;
  published?: boolean;
  compatibility?: CompatibilityInput[];
  initialStock?: number;
  initialUnitCost?: number;
}

const adminInclude = { ...productPublicInclude, supplier: { select: { id: true, name: true } } } satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async get(id: string, withCosts: boolean) {
    const p = await this.prisma.product.findUnique({ where: { id }, include: adminInclude });
    if (!p) throw new NotFoundException('Article introuvable.');
    return presentAdminProduct(this.storage, p, withCosts);
  }

  private async uniqueSlug(tx: Tx, name: string, excludeId?: string) {
    const base = slugify(name) || 'article';
    let slug = base;
    for (let i = 2; await tx.product.findFirst({ where: { slug, id: excludeId ? { not: excludeId } : undefined } }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }

  private async validateRefs(tx: Tx, input: Partial<ProductInput>, kind: ProductKind) {
    if (input.categoryId) {
      const category = await tx.category.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new BadRequestException('Catégorie introuvable.');
      if (category.kind !== kind) {
        throw new BadRequestException(
          kind === 'PART' ? 'Choisissez une catégorie de pièces détachées.' : "Choisissez une catégorie d'accessoires.",
        );
      }
    }
    if (input.compatibility?.length) {
      const modelIds = input.compatibility.map((c) => c.modelId).filter((m): m is string => Boolean(m));
      const models = await tx.phoneModel.findMany({ where: { id: { in: modelIds } } });
      for (const c of input.compatibility) {
        if (c.modelId && models.find((m) => m.id === c.modelId)?.brandId !== c.brandId) {
          throw new BadRequestException('Compatibilité invalide : le modèle ne correspond pas à la marque.');
        }
      }
    }
  }

  private async replaceCompatibility(tx: Tx, productId: string, items: CompatibilityInput[]) {
    await tx.productCompatibility.deleteMany({ where: { productId } });
    // Déduplication : une compatibilité « marque entière » rend inutiles les modèles de cette marque.
    const wholeBrands = new Set(items.filter((c) => !c.modelId).map((c) => c.brandId));
    const seen = new Set<string>();
    const rows = items.filter((c) => {
      if (c.modelId && wholeBrands.has(c.brandId)) return false;
      const key = `${c.brandId}:${c.modelId ?? '*'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (rows.length) {
      await tx.productCompatibility.createMany({
        data: rows.map((c) => ({ productId, brandId: c.brandId, phoneModelId: c.modelId ?? null })),
      });
    }
  }

  async create(input: ProductInput, userId: string, withCosts: boolean) {
    const kind = input.kind ?? 'ACCESSORY';
    if ((input.initialStock ?? 0) > 0 && input.initialUnitCost === undefined) {
      throw new BadRequestException('Indiquez le coût unitaire du stock initial.');
    }

    const id = await this.prisma.run(async (tx) => {
      await this.validateRefs(tx, input, kind);
      let sku = cleanOptional(input.sku)?.toUpperCase() ?? null;
      if (sku && (await tx.product.findUnique({ where: { sku } }))) throw new ConflictException('Cette référence existe déjà.');
      sku ??= await randomReference(kind === 'PART' ? 'PCE' : 'ACC', async (r) => Boolean(await tx.product.findUnique({ where: { sku: r }, select: { id: true } })));

      const product = await tx.product.create({
        data: {
          kind,
          sku,
          slug: await this.uniqueSlug(tx, input.name),
          name: input.name.trim(),
          description: input.description?.trim() ?? '',
          categoryId: input.categoryId,
          supplierId: input.supplierId ?? null,
          salePrice: input.salePrice,
          lowStockThreshold: input.lowStockThreshold ?? 2,
          // Une pièce détachée n'est jamais publiée sur le site.
          published: kind === 'ACCESSORY' ? (input.published ?? true) : false,
        },
      });
      if (input.compatibility) await this.replaceCompatibility(tx, product.id, input.compatibility);
      if ((input.initialStock ?? 0) > 0) {
        await this.stock.receive(tx, {
          productId: product.id,
          quantity: input.initialStock!,
          unitCost: input.initialUnitCost!,
          type: 'INITIAL',
          reason: 'Stock initial à la création de la fiche',
          userId,
        });
      }
      await this.audit.log(
        { userId, action: 'product.create', entity: 'Product', entityId: product.id, summary: `Article créé : ${product.name} (${product.sku})` },
        tx,
      );
      return product.id;
    });
    return this.get(id, withCosts);
  }

  async update(id: string, input: Partial<ProductInput>, userId: string, withCosts: boolean) {
    await this.prisma.run(async (tx) => {
      const current = await tx.product.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Article introuvable.');
      await this.validateRefs(tx, input, current.kind);

      const data: Prisma.ProductUncheckedUpdateInput = {};
      if (input.name !== undefined) data.name = input.name.trim();
      if (input.description !== undefined) data.description = input.description.trim();
      if (input.categoryId !== undefined) data.categoryId = input.categoryId;
      if (input.supplierId !== undefined) data.supplierId = input.supplierId;
      if (input.salePrice !== undefined) data.salePrice = input.salePrice;
      if (input.lowStockThreshold !== undefined) data.lowStockThreshold = input.lowStockThreshold;
      if (input.published !== undefined) data.published = current.kind === 'ACCESSORY' ? input.published : false;
      if (input.sku !== undefined) {
        const sku = input.sku.trim().toUpperCase();
        if (!sku) throw new BadRequestException('La référence ne peut pas être vide.');
        if (sku !== current.sku && (await tx.product.findUnique({ where: { sku } }))) {
          throw new ConflictException('Cette référence existe déjà.');
        }
        data.sku = sku;
      }

      await tx.product.update({ where: { id }, data });
      if (input.compatibility) await this.replaceCompatibility(tx, id, input.compatibility);

      if (input.salePrice !== undefined && input.salePrice !== current.salePrice) {
        await this.audit.log(
          {
            userId,
            action: 'product.price',
            entity: 'Product',
            entityId: id,
            summary: `Prix de vente modifié : ${current.salePrice} → ${input.salePrice} XOF`,
            details: { before: current.salePrice, after: input.salePrice },
          },
          tx,
        );
      }
    });
    return this.get(id, withCosts);
  }

  async setStatus(id: string, status: 'ACTIVE' | 'ARCHIVED', userId: string, withCosts: boolean) {
    const product = await this.prisma.product.update({ where: { id }, data: { status } });
    await this.audit.log({
      userId,
      action: status === 'ARCHIVED' ? 'product.archive' : 'product.restore',
      entity: 'Product',
      entityId: id,
      summary: `${status === 'ARCHIVED' ? 'Article archivé' : 'Article réactivé'} : ${product.name}`,
    });
    return this.get(id, withCosts);
  }

  async addImage(productId: string, file: Buffer, alt: string | undefined) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { _count: { select: { images: true } } } });
    if (!product) throw new NotFoundException('Article introuvable.');
    if (product._count.images >= 8) throw new BadRequestException('8 photos maximum par article.');
    const stored = await this.storage.savePublicImage(file, 'products');
    return this.prisma.productImage.create({
      data: {
        productId,
        storageKey: stored.key,
        width: stored.width,
        height: stored.height,
        alt: alt?.trim() || product.name,
        position: product._count.images,
      },
    });
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException('Photo introuvable.');
    await this.prisma.productImage.delete({ where: { id: imageId } });
    if (image.storageKey) await this.storage.removePublicImage(image.storageKey);
  }

  async reorderImages(productId: string, ids: string[]) {
    const images = await this.prisma.productImage.findMany({ where: { productId } });
    if (images.length !== ids.length || !images.every((i) => ids.includes(i.id))) {
      throw new BadRequestException("L'ordre transmis ne correspond pas aux photos de l'article.");
    }
    await this.prisma.$transaction(ids.map((id, position) => this.prisma.productImage.update({ where: { id }, data: { position } })));
  }
}
