import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, Tx } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  details?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Journal des opérations sensibles (finances, stocks, accès aux données protégées). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry, tx?: Tx) {
    const client = tx ?? this.prisma;
    return client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        details: entry.details,
        ip: entry.ip ?? null,
      },
    });
  }
}
