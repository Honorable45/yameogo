import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Transaction interactive au niveau d'isolation par défaut (READ COMMITTED).
   * Les opérations de stock verrouillent explicitement les lignes concernées (SELECT … FOR UPDATE).
   */
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.$transaction(fn, { maxWait: 5000, timeout: 15000 });
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
