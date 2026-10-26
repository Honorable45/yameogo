import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { BrandsController } from './brands.controller';
import { CategoriesController } from './categories.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ShopController } from './shop.controller';

@Module({
  imports: [InventoryModule],
  controllers: [CategoriesController, BrandsController, ProductsController, ShopController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class CatalogModule {}
