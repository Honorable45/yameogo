import { Controller, ForbiddenException, Get, Global, Module, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { can, Permission } from '../auth/permissions';
import { StorageService } from './storage.service';

// Permission requise selon le dossier du fichier privé.
const FOLDER_PERMISSION: Record<string, Permission> = {
  requests: 'requests.manage',
  receipts: 'expenses.manage',
};

/** Fichiers privés : servis uniquement à l'équipe connectée et autorisée. */
@Controller('files')
export class PrivateFilesController {
  constructor(private readonly storage: StorageService) {}

  @Get('private/*path')
  async read(@Param('path') path: string | string[], @CurrentUser() user: AuthUser, @Res() res: Response) {
    const relative = Array.isArray(path) ? path.join('/') : path;
    const permission = FOLDER_PERMISSION[relative.split('/')[0]];
    if (!permission || !can(user.role, permission)) throw new ForbiddenException("Accès à ce fichier non autorisé.");

    const file = await this.storage.readPrivateFile(`private/${relative}`);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.data);
  }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService], controllers: [PrivateFilesController] })
export class StorageModule {}
