import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Permission } from './permissions';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_PERMISSIONS = 'requiredPermissions';

/** Route accessible sans session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Exige toutes les permissions indiquées. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  sessionId: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user as AuthUser;
});

export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.ip ?? null;
});
