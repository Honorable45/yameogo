import { Body, Controller, Get, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { cleanOptional } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';

class SupplierDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class UpdateSupplierDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('suppliers.manage')
  async list(@Query('q') q?: string) {
    const suppliers = await this.prisma.supplier.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { purchases: true, products: true } } },
    });
    // Montant restant dû par fournisseur (approvisionnements validés).
    const dues = await this.prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { status: 'VALIDATED' },
      _sum: { total: true, amountPaid: true },
    });
    return suppliers.map((s) => {
      const d = dues.find((x) => x.supplierId === s.id);
      return { ...s, balanceDue: (d?._sum.total ?? 0) - (d?._sum.amountPaid ?? 0) };
    });
  }

  @Get(':id')
  @RequirePermissions('suppliers.manage')
  async get(@Param('id') id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: { orderBy: { purchaseDate: 'desc' }, take: 50, select: { id: true, number: true, purchaseDate: true, status: true, total: true, amountPaid: true, paymentStatus: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Fournisseur introuvable.');
    return supplier;
  }

  @Post()
  @RequirePermissions('suppliers.manage')
  async create(@Body() dto: SupplierDto, @CurrentUser() me: AuthUser) {
    const supplier = await this.prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        phone: cleanOptional(dto.phone),
        email: cleanOptional(dto.email),
        address: cleanOptional(dto.address),
        notes: cleanOptional(dto.notes),
      },
    });
    await this.audit.log({ userId: me.id, action: 'supplier.create', entity: 'Supplier', entityId: supplier.id, summary: `Fournisseur créé : ${supplier.name}` });
    return supplier;
  }

  @Patch(':id')
  @RequirePermissions('suppliers.manage')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone !== undefined ? cleanOptional(dto.phone) : undefined,
        email: dto.email !== undefined ? cleanOptional(dto.email) : undefined,
        address: dto.address !== undefined ? cleanOptional(dto.address) : undefined,
        notes: dto.notes !== undefined ? cleanOptional(dto.notes) : undefined,
        active: dto.active,
      },
    });
  }
}

@Module({ controllers: [SuppliersController] })
export class SuppliersModule {}
