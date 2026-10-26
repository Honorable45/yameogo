import { Body, ConflictException, Controller, Get, HttpCode, Module, NotFoundException, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpenseCategory, ExpenseStatus, PaymentMethod, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_UPLOAD_BYTES, StorageService } from '../storage/storage.service';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: 'Loyer',
  ELECTRICITY: 'Électricité',
  INTERNET: 'Internet et téléphone',
  TRANSPORT: 'Transport',
  SALARIES: 'Salaires',
  EQUIPMENT_MAINTENANCE: 'Entretien du matériel',
  SUPPLIES: 'Fournitures',
  OTHER: 'Autres dépenses',
};

/** Une dépense porte une date calendaire, stockée à minuit UTC (sans notion d'heure ni de fuseau). */
function calendarDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

class ExpenseDto {
  @IsString() @MinLength(2) @MaxLength(160) label: string;
  @IsEnum(ExpenseCategory) category: ExpenseCategory;
  @Type(() => Number) @IsInt({ message: 'Le montant doit être un entier en XOF.' }) @Min(1) @Max(100_000_000) amount: number;
  @IsDateString() expenseDate: string;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

class CorrectionDto extends ExpenseDto {
  @IsString() @MinLength(5, { message: 'Indiquez le motif de la correction.' }) @MaxLength(300) reason: string;
}

class VoidDto {
  @IsString() @MinLength(5, { message: "Indiquez le motif de l'annulation." }) @MaxLength(300) reason: string;
}

class ExpenseQuery extends PageQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(ExpenseCategory) category?: ExpenseCategory;
  @IsOptional() @IsEnum(ExpenseStatus) status?: ExpenseStatus;
}

/**
 * Dépenses générales (charges de fonctionnement).
 * Les achats de marchandises et de pièces ne sont pas des dépenses : ils passent par les
 * approvisionnements et entrent dans les coûts au moment de la vente ou de la réparation.
 * Une dépense n'est jamais supprimée : elle est annulée ou corrigée (nouvelle écriture liée).
 */
@Controller('expenses')
@RequirePermissions('expenses.manage')
export class ExpensesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private present<T extends { receiptKey: string | null; category: ExpenseCategory }>(e: T) {
    const { receiptKey, ...rest } = e;
    return { ...rest, categoryLabel: EXPENSE_CATEGORY_LABELS[e.category], receiptUrl: receiptKey ? `/api/files/${receiptKey}` : null };
  }

  @Get()
  async list(@Query() q: ExpenseQuery) {
    const where: Prisma.ExpenseWhereInput = {
      category: q.category,
      status: q.status ?? 'ACTIVE',
      // Dates calendaires : bornes incluses.
      expenseDate: q.from || q.to ? { gte: q.from ? calendarDate(q.from) : undefined, lt: q.to ? new Date(calendarDate(q.to).getTime() + 86400_000) : undefined } : undefined,
    };
    if (q.q) where.OR = [{ label: { contains: q.q, mode: 'insensitive' } }, { comment: { contains: q.q, mode: 'insensitive' } }];
    const [rows, total, sums] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        include: { createdBy: { select: { name: true } }, voidedBy: { select: { name: true } }, replaces: { select: { id: true, label: true } }, replacedBy: { select: { id: true } } },
        ...skipTake(q),
      }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true } }),
    ]);
    return {
      ...paginate(rows.map((e) => this.present(e)), total, q),
      totalAmount: sums.reduce((acc, s) => acc + (s._sum.amount ?? 0), 0),
      byCategory: sums.map((s) => ({ category: s.category, label: EXPENSE_CATEGORY_LABELS[s.category], amount: s._sum.amount ?? 0 })),
    };
  }

  @Post()
  @UseInterceptors(FileInterceptor('receipt', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async create(@Body() dto: ExpenseDto, @CurrentUser() me: AuthUser, @UploadedFile() receipt?: Express.Multer.File) {
    const receiptKey = receipt?.buffer?.length ? await this.storage.savePrivateFile(receipt.buffer, 'receipts', true) : null;
    const expense = await this.prisma.expense.create({
      data: {
        label: dto.label.trim(),
        category: dto.category,
        amount: dto.amount,
        expenseDate: calendarDate(dto.expenseDate),
        paymentMethod: dto.paymentMethod,
        comment: dto.comment?.trim() || null,
        receiptKey,
        createdById: me.id,
      },
    });
    await this.audit.log({ userId: me.id, action: 'expense.create', entity: 'Expense', entityId: expense.id, summary: `Dépense enregistrée : ${expense.label} — ${expense.amount} XOF` });
    return this.present(expense);
  }

  @Post(':id/void')
  @HttpCode(200)
  async void(@Param('id') id: string, @Body() dto: VoidDto, @CurrentUser() me: AuthUser) {
    const expense = await this.prisma.run(async (tx) => {
      const current = await tx.expense.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Dépense introuvable.');
      if (current.status === 'VOIDED') throw new ConflictException('Cette dépense est déjà annulée.');
      const updated = await tx.expense.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date(), voidReason: dto.reason.trim(), voidedById: me.id } });
      await this.audit.log({ userId: me.id, action: 'expense.void', entity: 'Expense', entityId: id, summary: `Dépense annulée : ${current.label} (${current.amount} XOF) — ${dto.reason}` }, tx);
      return updated;
    });
    return this.present(expense);
  }

  /** Correction : l'écriture d'origine est annulée et remplacée par une nouvelle, liée à elle. */
  @Post(':id/correct')
  async correct(@Param('id') id: string, @Body() dto: CorrectionDto, @CurrentUser() me: AuthUser) {
    const expense = await this.prisma.run(async (tx) => {
      const [row] = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Expense" WHERE "id" = ${id} FOR UPDATE`;
      if (!row) throw new NotFoundException('Dépense introuvable.');
      if (row.status === 'VOIDED') throw new ConflictException('Cette dépense est déjà annulée ou corrigée.');
      const current = await tx.expense.update({
        where: { id },
        data: { status: 'VOIDED', voidedAt: new Date(), voidReason: `Corrigée : ${dto.reason.trim()}`, voidedById: me.id },
      });
      const created = await tx.expense.create({
        data: {
          label: dto.label.trim(),
          category: dto.category,
          amount: dto.amount,
          expenseDate: calendarDate(dto.expenseDate),
          paymentMethod: dto.paymentMethod,
          comment: dto.comment?.trim() || null,
          receiptKey: current.receiptKey,
          replacesId: id,
          createdById: me.id,
        },
      });
      await this.audit.log(
        {
          userId: me.id,
          action: 'expense.correct',
          entity: 'Expense',
          entityId: created.id,
          summary: `Dépense corrigée : ${current.amount} → ${created.amount} XOF — ${dto.reason}`,
          details: { replaces: id },
        },
        tx,
      );
      return created;
    });
    return this.present(expense);
  }
}

@Module({ controllers: [ExpensesController] })
export class ExpensesModule {}
