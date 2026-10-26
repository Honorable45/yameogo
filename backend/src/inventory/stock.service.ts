import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType } from '@prisma/client';
import { averageCostAfterRemoval, weightedAverageCost } from '../common/money';
import { Tx } from '../prisma/prisma.service';

/**
 * Politique de stock (accessoires et pièces détachées)
 * ────────────────────────────────────────────────────
 * - stockQuantity    : quantité physiquement présente.
 * - reservedQuantity : quantité promise à des commandes en cours (non terminées).
 * - disponible       = stockQuantity − reservedQuantity.
 *
 * Commande en ligne créée      → réservation (aucun mouvement physique).
 * Commande terminée            → sortie SALE depuis la réservation, coût figé au coût moyen.
 * Commande annulée             → libération de la réservation.
 * Vente au comptoir            → sortie SALE immédiate.
 * Pièce ajoutée à une réparation → sortie REPAIR_USE immédiate (la pièce quitte le stock à la pose).
 * Pièce retirée d'une réparation → entrée REPAIR_RETURN au coût figé initialement.
 * Approvisionnement validé     → entrée PURCHASE au coût de revient (prix + frais répartis).
 *
 * Valorisation : coût moyen pondéré, recalculé à chaque entrée valorisée.
 * Chaque opération verrouille la ligne produit (SELECT … FOR UPDATE) : deux opérations
 * simultanées sur le même article sont exécutées l'une après l'autre.
 * La base refuse en dernier recours tout stock ou réservation négatifs (contraintes CHECK).
 */

interface LockedProduct {
  id: string;
  name: string;
  stockQuantity: number;
  reservedQuantity: number;
  averageCost: number;
}

export interface MovementRefs {
  reason?: string | null;
  userId?: string | null;
  purchaseItemId?: string;
  orderItemId?: string;
  repairPartId?: string;
  orderReturnId?: string;
  countLineId?: string;
}

@Injectable()
export class StockService {
  async lock(tx: Tx, productId: string): Promise<LockedProduct> {
    const rows = await tx.$queryRaw<LockedProduct[]>`
      SELECT "id", "name", "stockQuantity", "reservedQuantity", "averageCost"
      FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Article introuvable.');
    return rows[0];
  }

  private insufficient(p: LockedProduct, available: number): never {
    throw new ConflictException(
      `Stock insuffisant pour « ${p.name} » : ${Math.max(0, available)} disponible${available > 1 ? 's' : ''}.`,
    );
  }

  /** Réserve une quantité pour une commande. */
  async reserve(tx: Tx, productId: string, quantity: number) {
    const p = await this.lock(tx, productId);
    const available = p.stockQuantity - p.reservedQuantity;
    if (available < quantity) this.insufficient(p, available);
    await tx.product.update({ where: { id: productId }, data: { reservedQuantity: { increment: quantity } } });
  }

  /** Libère une réservation (annulation de commande). */
  async release(tx: Tx, productId: string, quantity: number) {
    const p = await this.lock(tx, productId);
    await tx.product.update({
      where: { id: productId },
      data: { reservedQuantity: Math.max(0, p.reservedQuantity - quantity) },
    });
  }

  /**
   * Sortie de stock valorisée au coût moyen courant. Renvoie le coût unitaire figé.
   * `fromReservation` : la quantité était réservée (commande) et la réservation est consommée.
   */
  async issue(
    tx: Tx,
    input: { productId: string; quantity: number; type: Extract<MovementType, 'SALE' | 'REPAIR_USE'>; fromReservation?: boolean } & MovementRefs,
  ): Promise<number> {
    const p = await this.lock(tx, input.productId);
    if (input.fromReservation) {
      if (p.reservedQuantity < input.quantity || p.stockQuantity < input.quantity) this.insufficient(p, p.stockQuantity);
    } else {
      const available = p.stockQuantity - p.reservedQuantity;
      if (available < input.quantity) this.insufficient(p, available);
    }
    const stockAfter = p.stockQuantity - input.quantity;
    await tx.product.update({
      where: { id: p.id },
      data: {
        stockQuantity: stockAfter,
        reservedQuantity: input.fromReservation ? p.reservedQuantity - input.quantity : p.reservedQuantity,
      },
    });
    await this.record(tx, p.id, input.type, -input.quantity, p.averageCost, stockAfter, p.averageCost, input);
    return p.averageCost;
  }

  /** Entrée de stock valorisée : met à jour le coût moyen pondéré. */
  async receive(
    tx: Tx,
    input: {
      productId: string;
      quantity: number;
      unitCost: number;
      type: Extract<MovementType, 'PURCHASE' | 'SALE_RETURN' | 'REPAIR_RETURN' | 'INITIAL'>;
    } & MovementRefs,
  ) {
    const p = await this.lock(tx, input.productId);
    const avg = weightedAverageCost(p.stockQuantity, p.averageCost, input.quantity, input.unitCost);
    const stockAfter = p.stockQuantity + input.quantity;
    await tx.product.update({ where: { id: p.id }, data: { stockQuantity: stockAfter, averageCost: avg } });
    await this.record(tx, p.id, input.type, input.quantity, input.unitCost, stockAfter, avg, input);
  }

  /** Retrait d'un lot valorisé à un coût précis (annulation d'approvisionnement). */
  async removeLot(tx: Tx, input: { productId: string; quantity: number; unitCost: number } & MovementRefs) {
    const p = await this.lock(tx, input.productId);
    const available = p.stockQuantity - p.reservedQuantity;
    if (available < input.quantity) this.insufficient(p, available);
    const avg = averageCostAfterRemoval(p.stockQuantity, p.averageCost, input.quantity, input.unitCost);
    const stockAfter = p.stockQuantity - input.quantity;
    await tx.product.update({ where: { id: p.id }, data: { stockQuantity: stockAfter, averageCost: avg } });
    await this.record(tx, p.id, 'PURCHASE_CANCEL', -input.quantity, input.unitCost, stockAfter, avg, input);
  }

  /**
   * Correction justifiée (ajustement manuel ou inventaire). Valorisée au coût moyen courant,
   * qui reste inchangé. Un ajustement ne peut pas rendre le stock négatif.
   */
  async adjust(tx: Tx, input: { productId: string; delta: number; type: Extract<MovementType, 'ADJUSTMENT' | 'COUNT'>; reason: string } & MovementRefs) {
    if (input.delta === 0) return;
    const p = await this.lock(tx, input.productId);
    const stockAfter = p.stockQuantity + input.delta;
    if (stockAfter < 0) this.insufficient(p, p.stockQuantity);
    await tx.product.update({ where: { id: p.id }, data: { stockQuantity: stockAfter } });
    await this.record(tx, p.id, input.type, input.delta, p.averageCost, stockAfter, p.averageCost, input);
  }

  private record(
    tx: Tx,
    productId: string,
    type: MovementType,
    quantity: number,
    unitCost: number,
    stockAfter: number,
    averageCostAfter: number,
    refs: MovementRefs,
  ) {
    return tx.inventoryMovement.create({
      data: {
        productId,
        type,
        quantity,
        unitCost,
        stockAfter,
        averageCostAfter,
        reason: refs.reason ?? null,
        userId: refs.userId ?? null,
        purchaseItemId: refs.purchaseItemId,
        orderItemId: refs.orderItemId,
        repairPartId: refs.repairPartId,
        orderReturnId: refs.orderReturnId,
        countLineId: refs.countLineId,
      },
    });
  }
}
