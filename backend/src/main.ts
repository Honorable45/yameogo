import 'reflect-metadata';

// En local, charge apps/api/.env s'il existe (en production, les variables sont fournies par l'hébergeur).
try {
  process.loadEnvFile();
} catch {
  /* aucun fichier .env : rien à faire */
}
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-error.filter';
import { loadConfig } from './config/env';

export function configureApp(app: NestExpressApplication) {
  const config = loadConfig();
  // Nombre de proxys de confiance devant l'API (Render : 1 ; Vercel → Render : 2). Sert à lire l'IP réelle du client.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({
    origin: [config.webOrigin, config.adminOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  });
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => {
        const first = errors[0];
        const message = first?.constraints ? Object.values(first.constraints)[0] : first?.children?.length ? 'Données invalides.' : 'Requête invalide.';
        return new BadRequestException({ message, fields: errors.map((e) => e.property) });
      },
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  if (config.storage.driver === 'local') {
    // Images publiques uniquement : le dossier « private » n'est jamais servi statiquement.
    app.use('/uploads/private', (_req: unknown, res: { status: (c: number) => { end: () => void } }) => res.status(404).end());
    app.useStaticAssets(config.storage.localDir, { prefix: '/uploads', maxAge: '365d', immutable: true, index: false, dotfiles: 'deny' });
  }
}

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`API YAMEOGO disponible sur le port ${config.port}`, 'Bootstrap');
}

if (require.main === module) {
  void bootstrap();
}
