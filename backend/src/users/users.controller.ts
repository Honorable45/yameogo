import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { assertPasswordPolicy, hashPassword } from '../auth/auth.service';
import { AuthUser, CurrentUser, RequirePermissions } from '../auth/decorators';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';

class CreateUserDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @MaxLength(200)
  password: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;
}

const PUBLIC_FIELDS = { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true } as const;

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Liste réduite (nom, rôle) utile aux formulaires : affectation d'un réparateur. */
  @Get('staff')
  @RequirePermissions('repairs.read')
  staff() {
    return this.prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } });
  }

  @Get()
  @RequirePermissions('users.manage')
  list() {
    return this.prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  }

  @Post()
  @RequirePermissions('users.manage')
  async create(@Body() dto: CreateUserDto, @CurrentUser() me: AuthUser) {
    assertPasswordPolicy(dto.password);
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');
    }
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), role: dto.role, passwordHash: await hashPassword(dto.password) },
      select: PUBLIC_FIELDS,
    });
    await this.audit.log({ userId: me.id, action: 'user.create', entity: 'User', entityId: user.id, summary: `Compte créé : ${user.email} (${user.role})` });
    return user;
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: AuthUser) {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    if (target.id === me.id && (dto.active === false || (dto.role && dto.role !== 'MANAGER'))) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte ni retirer votre rôle de Responsable.');
    }
    // Il doit toujours rester au moins un Responsable actif.
    if (target.role === 'MANAGER' && (dto.active === false || (dto.role && dto.role !== 'MANAGER'))) {
      const managers = await this.prisma.user.count({ where: { role: 'MANAGER', active: true } });
      if (managers <= 1) throw new BadRequestException('Il doit rester au moins un Responsable actif.');
    }

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name.trim();
    if (dto.role) data.role = dto.role;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password) {
      assertPasswordPolicy(dto.password);
      data.passwordHash = await hashPassword(dto.password);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id }, data, select: PUBLIC_FIELDS });
      // Désactivation, changement de rôle ou de mot de passe : les sessions ouvertes sont fermées.
      if (dto.active === false || dto.role || dto.password) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return updated;
    });

    await this.audit.log({
      userId: me.id,
      action: 'user.update',
      entity: 'User',
      entityId: id,
      summary: `Compte modifié : ${user.email}`,
      details: { name: dto.name, role: dto.role, active: dto.active, passwordReset: Boolean(dto.password) },
    });
    return user;
  }
}
