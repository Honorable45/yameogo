import { Controller, Get, Module, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

/** Recherche transversale de l'administration (ventes, clients, produits et leurs variantes). */
@Controller('search')
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@Query('q') raw: string, @CurrentUser() me: AuthUser) {
    const q = (raw ?? '').trim().slice(0, 80);
    if (q.length < 2) return { results: [] };
    const digits = q.replace(/\D/g, '');
    const text = { contains: q, mode: 'insensitive' as const };
    const take = 5;

    const [customers, products, orders] = await Promise.all([
      can(me.role, 'customers.read')
        ? this.prisma.customer.findMany({
            where: { OR: [{ name: text }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] },
            select: { id: true, name: true, phone: true },
            take,
          })
        : [],
      can(me.role, 'catalog.read')
        ? this.prisma.product.findMany({
            where: { status: 'ACTIVE', OR: [{ name: text }, { sku: text }] },
            select: { id: true, name: true, sku: true, kind: true, stockQuantity: true, groupId: true },
            take,
          })
        : [],
      can(me.role, 'orders.read')
        ? this.prisma.order.findMany({
            where: { OR: [{ number: text }, { customerName: text }, ...(digits.length >= 4 ? [{ customerPhone: { contains: digits } }] : [])] },
            select: { id: true, number: true, customerName: true, status: true, total: true },
            orderBy: { createdAt: 'desc' },
            take,
          })
        : [],
    ]);

    return {
      results: [
        ...orders.map((o) => ({ type: 'order', id: o.id, title: o.number, subtitle: o.customerName, href: `/commandes/${o.id}` })),
        ...customers.map((c) => ({ type: 'customer', id: c.id, title: c.name, subtitle: c.phone, href: `/clients/${c.id}` })),
        ...products.map((p) => ({ type: 'product', id: p.id, title: p.name, subtitle: `${p.sku} · stock ${p.stockQuantity}`, href: `/catalogue/${p.groupId}` })),
      ],
    };
  }
}

@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read')
  async list(@Query() q: PageQuery) {
    const where = q.q ? { OR: [{ summary: { contains: q.q, mode: 'insensitive' as const } }, { action: { contains: q.q } }] } : {};
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: { id: true, action: true, entity: true, entityId: true, summary: true, createdAt: true, user: { select: { name: true } } },
        ...skipTake(q),
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(rows, total, q);
  }
}

@Module({ controllers: [SearchController, AuditController] })
export class SearchModule {}
