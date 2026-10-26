import { Body, Controller, HttpCode, Module, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { OnlinePaymentsService } from './online-payments.service';
import { PaygateProvider } from './paygate.provider';
import { PaymentsService } from './payments.service';

class ReasonDto {
  @IsString() @MinLength(5, { message: 'Indiquez un motif (5 caractères minimum).' }) @MaxLength(300) reason: string;
}

class PaygateCallbackDto {
  @IsString() @MaxLength(100) identifier: string;
  @IsOptional() @IsString() @MaxLength(100) tx_reference?: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly online: OnlinePaymentsService,
  ) {}

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('payments.cancel')
  cancel(@Param('id') id: string, @Body() dto: ReasonDto, @CurrentUser() me: AuthUser) {
    return this.payments.cancel(id, dto.reason.trim(), me.id);
  }

  /**
   * Notification du prestataire. Son contenu sert uniquement à identifier le paiement :
   * le statut est revérifié auprès du prestataire avant toute confirmation.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('paygate/callback')
  @HttpCode(200)
  async callback(@Body() dto: PaygateCallbackDto) {
    if (this.online.enabled) await this.online.verify(dto.identifier).catch(() => undefined);
    return { received: true };
  }
}

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaygateProvider, OnlinePaymentsService],
  exports: [PaymentsService, OnlinePaymentsService],
})
export class PaymentsModule {}
