import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { PublicRepairCatalogController, RepairPricingController } from './repair-catalog.controller';
import { RepairRequestsController } from './repair-requests.controller';
import { RepairsController } from './repairs.controller';
import { RepairsService } from './repairs.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [InventoryModule, PaymentsModule, CustomersModule],
  controllers: [PublicRepairCatalogController, RepairPricingController, RepairRequestsController, RepairsController, TrackingController],
  providers: [RepairsService],
  exports: [RepairsService],
})
export class RepairsModule {}
