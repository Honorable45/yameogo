import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import type { Response } from 'express';

/**
 * Format d'erreur unique : { statusCode, message, ...détails }.
 * Les erreurs internes ne divulguent jamais de détails techniques au client.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erreur');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ThrottlerException) {
      return res.status(429).json({ statusCode: 429, message: 'Trop de tentatives. Patientez quelques instants avant de réessayer.' });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload = typeof body === 'string' ? { message: body } : (body as Record<string, unknown>);
      let message = payload.message;
      if (Array.isArray(message)) message = message[0];
      if (status === 404 && (!message || message === 'Not Found' || String(message).startsWith('Cannot'))) message = 'Ressource introuvable.';
      if (status === 413) message = 'Fichier trop lourd (8 Mo maximum).';
      return res.status(status).json({ ...payload, statusCode: status, message, error: undefined });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') return res.status(404).json({ statusCode: 404, message: 'Élément introuvable.' });
      if (exception.code === 'P2002') return res.status(409).json({ statusCode: 409, message: 'Cet élément existe déjà.' });
      if (exception.code === 'P2003') return res.status(400).json({ statusCode: 400, message: 'Référence invalide.' });
    }
    // Violation d'une contrainte CHECK (stock négatif…) : refus métier, pas une panne.
    if (exception instanceof Prisma.PrismaClientUnknownRequestError || exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (/check constraint/i.test(exception.message)) {
        return res.status(409).json({ statusCode: 409, message: 'Opération refusée : elle rendrait les données incohérentes (stock ou montant invalide).' });
      }
    }
    if (exception && typeof exception === 'object' && 'code' in exception && (exception as { code: string }).code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ statusCode: 413, message: 'Fichier trop lourd (8 Mo maximum).' });
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Une erreur inattendue est survenue. Réessayez dans un instant.' });
  }
}
