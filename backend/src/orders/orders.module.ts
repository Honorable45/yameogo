import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FulfillmentMethod, OrderChannel, OrderStatus, PaymentKind, PaymentMethod, PaymentPreference, Prisma, SettlementStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { sum } from '../common/money';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OnlinePaymentsService } from '../payments/online-payments.service';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaService } from '../prisma/prisma.service';
import { UsedPhonesModule } from '../used-phones/used-phones.module';
import { allowedOrderTransitions, ORDER_STATUS_LABELS } from './order-rules';
import { OrderDetail, OrdersService } from './orders.service';

class CartItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() usedPhoneId?: string;
  @IsInt() @Min(1) @Max(50) quantity: number;
}

class CounterItemDto extends CartItemDto {
  @IsOptional() @IsInt() @Min(0) @Max(50_000_000) unitPrice?: number;
}

class QuoteDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CartItemDto) items: CartItemDto[];
  @IsOptional() @IsEnum(FulfillmentMethod) fulfillment?: FulfillmentMethod;
}

class CheckoutDto {
  @IsString() @MinLength(2, { message: 'Indiquez votre nom.' }) @MaxLength(120) customerName: string;
  @IsString() @MinLength(8, { message: 'Numéro de téléphone invalide.' }) @MaxLength(30) customerPhone: string;
  @IsEnum(FulfillmentMethod) fulfillment: FulfillmentMethod;
  @IsOptional() @IsString() @MaxLength(400) deliveryAddress?: string;
  @IsEnum(PaymentPreference) paymentPreference: PaymentPreference;
  @IsOptional() @IsString() @MaxLength(600) comment?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Votre panier est vide.' }) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CartItemDto) items: CartItemDto[];
}

class PayDto {
  @IsString() @MaxLength(64) token: string;
  @IsIn(['TMONEY', 'FLOOZ']) network: 'TMONEY' | 'FLOOZ';
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
}

class CounterPaymentDto {
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsInt() @Min(0) @Max(100_000_000) amount: number;
  @IsOptional() @IsString() @MaxLength(80) externalReference?: string;
}

class CounterSaleDto {
  @IsOptional() @IsString() @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(30) customerPhone?: string;
  @IsOptional() @IsString() @MaxLength(600) comment?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CounterItemDto) items: CounterItemDto[];
  @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => CounterPaymentDto) payments: CounterPaymentDto[];
}

class StatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class PaymentDto {
  @IsEnum(PaymentKind) kind: PaymentKind;
  @IsInt() @Min(1) @Max(100_000_000) amount: number;
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(80) externalReference?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class RefundDto {
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsInt() @Min(0) @Max(100_000_000) amount: number;
}

class ReturnDto {
  @IsString() itemId: string;
  @IsInt() @Min(1) @Max(1000) quantity: number;
  @IsBoolean() restock: boolean;
  @IsString() @MinLength(5, { message: 'Indiquez le motif du retour.' }) @MaxLength(300) reason: string;
  @IsOptional() @ValidateNested() @Type(() => RefundDto) refund?: RefundDto;
}

class OrderQuery extends PageQuery {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsEnum(OrderChannel) channel?: OrderChannel;
  @IsOptional() @IsEnum(SettlementStatus) paymentStatus?: SettlementStatus;
  @IsOptional() @IsIn(['open']) scope?: 'open';
}

@Public()
@Controller('shop')
export class PublicOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly online: OnlinePaymentsService,
  ) {}

  @Post('cart/quote')
  @HttpCode(200)
  quote(@Body() dto: QuoteDto) {
    return this.orders.quote(dto.items, dto.fulfillment);
  }

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('orders')
  checkout(@Body() dto: CheckoutDto) {
    return this.orders.checkout(dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('orders/:number')
  view(@Param('number') number: string, @Query('token') token: string) {
    return this.orders.publicView(number, token ?? '');
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('orders/:number/pay')
  @HttpCode(200)
  async pay(@Param('number') number: string, @Body() dto: PayDto) {
    const order = await this.orders.findByToken(number, dto.token);
    // Sans numéro précisé, la demande est envoyée au numéro de la commande.
    const phone = dto.phone && dto.phone.replace(/\D/g, '').length >= 8 ? dto.phone : order.customerPhone;
    return this.online.initiate(order.id, dto.network, phone);
  }
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  private present(order: OrderDetail, withCosts: boolean) {
    const items = order.items.map((i) => ({
      ...i,
      unitCost: withCosts ? i.unitCost : null,
      grossMargin: withCosts && i.unitCost !== null ? (i.unitPrice - i.unitCost) * (i.quantity - i.returnedQuantity) : null,
    }));
    const returnedAmount = sum(order.returns.map((r) => r.amount));
    return {
      ...order,
      accessToken: undefined,
      items,
      statusLabel: ORDER_STATUS_LABELS[order.status],
      allowedTransitions: allowedOrderTransitions(order.status, order.fulfillment),
      returnedAmount,
      balanceDue: order.total - returnedAmount - order.amountPaid,
      grossMargin:
        withCosts && order.status === 'COMPLETED'
          ? sum(items.map((i) => i.grossMargin ?? 0)) - sum(order.returns.filter((r) => !r.restocked).map((r) => (order.items.find((i) => i.id === r.orderItemId)?.unitCost ?? 0) * r.quantity))
          : null,
    };
  }

  @Get()
  @RequirePermissions('orders.read')
  async list(@Query() q: OrderQuery) {
    const where: Prisma.OrderWhereInput = { status: q.status, channel: q.channel, paymentStatus: q.paymentStatus };
    if (q.scope === 'open') where.status = { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'] };
    if (q.q) {
      const digits = q.q.replace(/\D/g, '');
      where.OR = [
        { number: { contains: q.q, mode: 'insensitive' } },
        { customerName: { contains: q.q, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ customerPhone: { contains: digits } }] : []),
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true, number: true, channel: true, status: true, customerName: true, customerPhone: true, fulfillment: true,
          paymentPreference: true, total: true, amountPaid: true, paymentStatus: true, createdAt: true, completedAt: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows.map((o) => ({ ...o, statusLabel: ORDER_STATUS_LABELS[o.status] })), total, q);
  }

  @Get(':id')
  @RequirePermissions('orders.read')
  async get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.present(await this.orders.get(id), can(me.role, 'costs.read'));
  }

  @Post('counter-sale')
  @RequirePermissions('orders.manage')
  async counterSale(@Body() dto: CounterSaleDto, @CurrentUser() me: AuthUser) {
    const order = await this.orders.counterSale(dto, { id: me.id, canOverridePrice: can(me.role, 'catalog.write') });
    return this.present(order, can(me.role, 'costs.read'));
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermissions('orders.manage')
  async status(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.orders.changeStatus(id, dto.status, dto.note, me.id), can(me.role, 'costs.read'));
  }

  @Post(':id/payments')
  @RequirePermissions('orders.manage')
  async payment(@Param('id') id: string, @Body() dto: PaymentDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.orders.recordPayment(id, dto, me.id), can(me.role, 'costs.read'));
  }

  @Post(':id/returns')
  @RequirePermissions('orders.returns')
  async registerReturn(@Param('id') id: string, @Body() dto: ReturnDto, @CurrentUser() me: AuthUser) {
    return this.present(await this.orders.registerReturn(id, dto, me.id), true);
  }
}

@Module({
  imports: [InventoryModule, UsedPhonesModule, PaymentsModule, CustomersModule],
  controllers: [PublicOrdersController, OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
