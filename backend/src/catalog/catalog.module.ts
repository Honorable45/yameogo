import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { BrandsController } from './brands.controller';
import { CategoriesController } from './categories.controller';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { ProductsController } from './products.controller';
import { ShopController } from './shop.controller';

@Module({
  imports: [InventoryModule],
  controllers: [CategoriesController, BrandsController, GroupsController, ProductsController, ShopController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class CatalogModule {}
