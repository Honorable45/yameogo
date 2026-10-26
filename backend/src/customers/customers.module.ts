import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { can } from '../auth/permissions';
import { PageQuery, paginate, skipTake } from '../common/pagination';
import { cleanOptional, isValidPhone, normalizePhone } from '../common/text';
import { PrismaService, Tx } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  /**
   * Retrouve un client par son numéro (normalisé) ou le crée.
   * Le nom enregistré n'est pas écrasé par une saisie ultérieure, sauf s'il était vide.
   */
  async findOrCreate(tx: Tx, input: { name?: string | null; phone: string; email?: string | null }) {
    if (!isValidPhone(input.phone)) throw new BadRequestException('Numéro de téléphone invalide.');
    const phone = normalizePhone(input.phone);
    const name = input.name?.trim() || 'Client';
    const existing = await tx.customer.findUnique({ where: { phone } });
    if (existing) {
      if ((existing.name === 'Client' && name !== 'Client') || (!existing.email && input.email)) {
        return tx.customer.update({
          where: { id: existing.id },
          data: { name: existing.name === 'Client' ? name : undefined, email: existing.email ?? cleanOptional(input.email) },
        });
      }
      return existing;
    }
    // ON CONFLICT : deux créations simultanées du même numéro ne produisent qu'un client.
    await tx.$executeRaw`
      INSERT INTO "Customer" ("id", "name", "phone", "email", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${name}, ${phone}, ${cleanOptional(input.email)}, NOW(), NOW())
      ON CONFLICT ("phone") DO NOTHING`;
    return tx.customer.findUniqueOrThrow({ where: { phone } });
  }
}

class CustomerDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @MaxLength(30) phone: string;
  @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
  ) {}

  @Get()
  @RequirePermissions('customers.read')
  async list(@Query() q: PageQuery) {
    const where: Prisma.CustomerWhereInput = {};
    if (q.q) {
      const digits = q.q.replace(/\D/g, '');
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
        { email: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { orders: true, repairJobs: true } } },
        ...skipTake(q),
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginate(rows, total, q);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  async get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        orders: can(me.role, 'orders.read')
          ? { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, number: true, status: true, total: true, paymentStatus: true, createdAt: true, channel: true } }
          : false,
        repairJobs: {
          orderBy: { receivedAt: 'desc' },
          take: 50,
          select: { id: true, number: true, status: true, brandName: true, modelName: true, billedAmount: true, paymentStatus: true, receivedAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Client introuvable.');
    return customer;
  }

  @Post()
  @RequirePermissions('customers.write')
  create(@Body() dto: CustomerDto) {
    return this.prisma.run((tx) => this.customers.findOrCreate(tx, dto));
  }

  @Patch(':id')
  @RequirePermissions('customers.write')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    const data: Prisma.CustomerUpdateInput = { name: dto.name?.trim() };
    if (dto.phone !== undefined) {
      if (!isValidPhone(dto.phone)) throw new BadRequestException('Numéro de téléphone invalide.');
      const phone = normalizePhone(dto.phone);
      const other = await this.prisma.customer.findUnique({ where: { phone } });
      if (other && other.id !== id) throw new BadRequestException('Ce numéro appartient déjà à un autre client.');
      data.phone = phone;
    }
    if (dto.email !== undefined) data.email = cleanOptional(dto.email);
    if (dto.notes !== undefined) data.notes = cleanOptional(dto.notes);
    return this.prisma.customer.update({ where: { id }, data });
  }
}

@Module({ controllers: [CustomersController], providers: [CustomersService], exports: [CustomersService] })
export class CustomersModule {}
