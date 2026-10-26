import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { AuditService } from '../common/audit.service';
import { CryptoService } from '../common/crypto.service';
import { loadConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators';

export const SESSION_COOKIE = 'ymg_session';
const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
// Évite d'écrire en base à chaque requête : la date d'activité est rafraîchie au plus toutes les 5 minutes.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function hashPassword(password: string) {
  return hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export function assertPasswordPolicy(password: string) {
  if (password.length < 10) throw new BadRequestException('Le mot de passe doit contenir au moins 10 caractères.');
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new BadRequestException('Le mot de passe doit contenir des lettres et des chiffres.');
  }
}

@Injectable()
export class AuthService {
  private readonly config = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: { ip?: string | null; userAgent?: string | null }) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    const invalid = new UnauthorizedException('Adresse e-mail ou mot de passe incorrect.');

    if (!user || !user.active) {
      // Calcul factice pour ne pas révéler l'existence du compte par le temps de réponse.
      await hashPassword(password);
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.');
    }

    const ok = await verify(user.passwordHash, password);
    if (!ok) {
      const failed = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await this.audit.log({ userId: user.id, action: 'auth.failed', entity: 'User', entityId: user.id, summary: 'Échec de connexion', ip: meta.ip });
      throw invalid;
    }

    const token = this.crypto.randomToken(32);
    const expiresAt = new Date(Date.now() + this.config.sessionTtlHours * 3600_000);
    await this.prisma.$transaction([
      this.prisma.session.create({
        data: {
          tokenHash: this.crypto.hmac(token, 'session'),
          userId: user.id,
          expiresAt,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent?.slice(0, 250) ?? null,
        },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } }),
    ]);
    await this.audit.log({ userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, summary: 'Connexion', ip: meta.ip });

    return { token, expiresAt, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  async resolveSession(token: string): Promise<AuthUser | null> {
    if (token.length > 100) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.crypto.hmac(token, 'session') },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.active) return null;

    if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    }
    const { user } = session;
    return { id: user.id, email: user.email, name: user.name, role: user.role, sessionId: session.id };
  }

  async logout(sessionId: string) {
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }

  async changePassword(userId: string, current: string, next: string, currentSessionId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verify(user.passwordHash, current))) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }
    assertPasswordPolicy(next);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
      // Les autres sessions ouvertes sont fermées.
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null, id: { not: currentSessionId } },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({ userId, action: 'auth.password', entity: 'User', entityId: userId, summary: 'Mot de passe modifié' });
  }
}
