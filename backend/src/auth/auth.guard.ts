import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, SESSION_COOKIE } from './auth.service';
import { AuthedRequest, IS_PUBLIC, REQUIRED_PERMISSIONS } from './decorators';
import { can, Permission } from './permissions';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'yameogo';

/**
 * Garde global : toute route est privée sauf si elle est marquée @Public().
 * - Vérifie la session (cookie httpOnly).
 * - Exige l'en-tête X-Requested-With sur les requêtes modifiantes authentifiées : un formulaire
 *   d'un autre site ne peut pas l'ajouter sans pré-vérification CORS, ce qui bloque le CSRF.
 * - Vérifie les permissions déclarées par @RequirePermissions().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);

    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const user = await this.auth.resolveSession(token);
      if (user) req.user = user;
    }

    if (isPublic) return true;
    if (!req.user) throw new UnauthorizedException('Session expirée ou absente. Veuillez vous reconnecter.');

    if (!SAFE_METHODS.has(req.method) && req.headers[CSRF_HEADER] !== CSRF_VALUE) {
      throw new ForbiddenException('Requête refusée (en-tête de sécurité manquant).');
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, targets) ?? [];
    const missing = required.filter((p) => !can(req.user!.role, p));
    if (missing.length) {
      throw new ForbiddenException("Vous n'avez pas l'autorisation d'effectuer cette action.");
    }
    return true;
  }
}
