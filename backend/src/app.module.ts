import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { Public } from './auth/decorators';
import { AuthService } from './auth/auth.service';
import { CatalogModule } from './catalog/catalog.module';
import { CommonModule } from './common/common.module';
import { CustomersModule } from './customers/customers.module';
import { ExpensesModule } from './expenses/expenses.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule, PrismaService } from './prisma/prisma.service';
import { PurchasesModule } from './purchases/purchases.module';
import { RepairsModule } from './repairs/repairs.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.controller';
import { StatsModule } from './stats/stats.module';
import { StorageModule } from './storage/storage.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { UsedPhonesModule } from './used-phones/used-phones.module';
import { UsersController } from './users/users.controller';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    // Limite par défaut : 300 requêtes par minute et par adresse IP ; limites plus strictes sur les routes sensibles.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      // Désactivé uniquement pendant les tests automatisés (nombreuses requêtes depuis la même adresse).
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    CommonModule,
    StorageModule,
    InventoryModule,
    CatalogModule,
    SettingsModule,
    CustomersModule,
    SuppliersModule,
    PurchasesModule,
    UsedPhonesModule,
    PaymentsModule,
    OrdersModule,
    RepairsModule,
    ExpensesModule,
    ReviewsModule,
    StatsModule,
    SearchModule,
  ],
  controllers: [HealthController, AuthController, UsersController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
