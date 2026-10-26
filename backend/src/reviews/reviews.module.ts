import { Body, Controller, Get, HttpCode, Module, NotFoundException, Param, PipeTransform, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma, ReviewService, ReviewStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, ClientIp, CurrentUser, Public, RequirePermissions } from '../auth/decorators';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewsService, SERVICE_LABELS, type ReviewTarget } from './reviews.service';

class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) ratingRepair?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) ratingWelcome?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5) ratingValue?: number;
  @IsOptional() @IsString() @MaxLength(1500) comment?: string;
  @IsOptional() @IsString() @MaxLength(40) displayName?: string;
  /** Ignoré : le type de service est déduit du code (accepté pour les anciennes versions du formulaire). */
  @IsOptional() @IsEnum(ReviewService) serviceType?: ReviewService;
  @IsString({ message: 'Le code d’avis est obligatoire.' }) @MinLength(8, { message: 'Le code d’avis est obligatoire.' }) @MaxLength(20) code: string;
}

class ModerateDto {
  @IsEnum(ReviewStatus) status: ReviewStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class ReplyDto {
  @IsOptional() @IsString() @MaxLength(800) reply?: string | null;
}

class AdminQuery extends PageQuery {
  @IsOptional() @IsEnum(ReviewStatus) status?: ReviewStatus;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() verified?: boolean;
}

const publicSelect = {
  id: true,
  rating: true,
  ratingRepair: true,
  ratingWelcome: true,
  ratingValue: true,
  comment: true,
  displayName: true,
  serviceType: true,
  verified: true,
  shopReply: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('public')
  async publicList(@Query() q: PageQuery) {
    const where: Prisma.ReviewWhereInput = { status: 'PUBLISHED' };
    const [rows, total, agg, verifiedCount] = await Promise.all([
      this.prisma.review.findMany({ where, select: publicSelect, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where, _avg: { rating: true, ratingRepair: true, ratingWelcome: true, ratingValue: true } }),
      this.prisma.review.count({ where: { ...where, verified: true } }),
    ]);
    const round = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
    return {
      ...paginate(rows.map((r) => ({ ...r, serviceLabel: SERVICE_LABELS[r.serviceType] })), total, q),
      summary: {
        count: total,
        verifiedCount,
        average: round(agg._avg.rating),
        averageRepair: round(agg._avg.ratingRepair),
        averageWelcome: round(agg._avg.ratingWelcome),
        averageValue: round(agg._avg.ratingValue),
      },
    };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  @Get('check-code')
  checkCode(@Query('code') code: string) {
    return this.reviews.checkCode(code ?? '');
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 10 * 60_000 } })
  @Post()
  submit(@Body() dto: ReviewDto, @ClientIp() ip: string | null) {
    return this.reviews.submit(dto, ip);
  }

  @Get()
  @RequirePermissions('reviews.moderate')
  async list(@Query() q: AdminQuery) {
    const where: Prisma.ReviewWhereInput = { status: q.status, verified: q.verified };
    const [rows, total, counts] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { repairJob: { select: { id: true, number: true } }, order: { select: { id: true, number: true } }, moderatedBy: { select: { name: true } } },
        ...skipTake(q),
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      ...paginate(rows.map(({ ipHash: _ip, ...r }) => ({ ...r, serviceLabel: SERVICE_LABELS[r.serviceType] })), total, q),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    };
  }

  @Post(':id/moderate')
  @HttpCode(200)
  @RequirePermissions('reviews.moderate')
  moderate(@Param('id') id: string, @Body() dto: ModerateDto, @CurrentUser() me: AuthUser) {
    return this.reviews.moderate(id, dto.status, dto.note, me.id);
  }

  @Post(':id/reply')
  @HttpCode(200)
  @RequirePermissions('reviews.moderate')
  reply(@Param('id') id: string, @Body() dto: ReplyDto, @CurrentUser() me: AuthUser) {
    return this.reviews.reply(id, dto.reply ?? null, me.id);
  }
}

/** « reparation » ou « vente » uniquement. */
class KindPipe implements PipeTransform<string> {
  transform(value: string) {
    if (value !== 'reparation' && value !== 'vente') throw new NotFoundException();
    return value;
  }
}

/** Codes d'avis d'une réparation ou d'une vente (affichés dans l'administration, remis au client). */
@Controller('review-codes')
export class ReviewCodesController {
  constructor(private readonly reviews: ReviewsService) {}

  private target(kind: string, id: string): ReviewTarget {
    return { kind: kind === 'reparation' ? 'repair' : 'order', id };
  }

  @Get(':kind/:id')
  @RequirePermissions('reviews.tokens')
  current(@Param('kind', new KindPipe()) kind: string, @Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.reviews.currentCode(this.target(kind, id), me.id);
  }

  @Post(':kind/:id/regenerate')
  @HttpCode(200)
  @RequirePermissions('reviews.tokens')
  regenerate(@Param('kind', new KindPipe()) kind: string, @Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.reviews.regenerateCode(this.target(kind, id), me.id);
  }
}

@Module({ controllers: [ReviewsController, ReviewCodesController], providers: [ReviewsService] })
export class ReviewsModule {}
