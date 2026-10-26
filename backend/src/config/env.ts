/**
 * Lecture et validation des variables d'environnement.
 * L'application refuse de démarrer si une valeur obligatoire est absente ou invalide.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  webOrigin: string;
  adminOrigin: string;
  apiPublicUrl: string;
  timezone: string;
  appSecret: string;
  encryptionKey: Buffer;
  sessionTtlHours: number;
  cookieSecure: boolean;
  storage: {
    driver: 'local' | 'cloudinary';
    localDir: string;
    cloudinary: { cloudName: string; apiKey: string; apiSecret: string } | null;
  };
  paygateApiKey?: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value.trim();
}

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  const appSecret = required('APP_SECRET');
  if (appSecret.length < 32) {
    throw new Error('APP_SECRET doit contenir au moins 32 caractères.');
  }

  const encryptionKey = Buffer.from(required('DATA_ENCRYPTION_KEY'), 'base64');
  if (encryptionKey.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY doit représenter exactement 32 octets encodés en base64.');
  }

  // Images sur Cloudinary dès que CLOUDINARY_URL est renseignée (cloudinary://CLE:SECRET@NOM_DU_CLOUD), sinon sur disque.
  // Tolère le copier-coller de la ligne entière affichée par Cloudinary (« CLOUDINARY_URL=cloudinary://… ») et les guillemets.
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim().replace(/^CLOUDINARY_URL=/, '').replace(/^["']|["']$/g, '');
  let cloudinary: AppConfig['storage']['cloudinary'] = null;
  // Le SDK Cloudinary relit cette variable à son chargement : on n'y laisse que la valeur nettoyée.
  if (cloudinaryUrl) process.env.CLOUDINARY_URL = cloudinaryUrl;
  else delete process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) {
    const m = cloudinaryUrl.match(/^cloudinary:\/\/([^:@\s]+):([^@\s]+)@([^/\s?]+)$/);
    if (!m) throw new Error('CLOUDINARY_URL doit avoir la forme cloudinary://CLE_API:SECRET_API@NOM_DU_CLOUD.');
    cloudinary = { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
  }
  const driver = cloudinary ? 'cloudinary' : 'local';

  const port = Number(process.env.PORT ?? 4100);
  const production = process.env.NODE_ENV === 'production';

  cached = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port,
    // En production, pas de repli localhost : les liens (QR codes d'avis…) seraient inutilisables.
    webOrigin: (production ? required('WEB_ORIGIN') : (process.env.WEB_ORIGIN ?? 'http://localhost:3100')).replace(/\/$/, ''),
    adminOrigin: (production ? required('ADMIN_ORIGIN') : (process.env.ADMIN_ORIGIN ?? 'http://localhost:3101')).replace(/\/$/, ''),
    // Render fournit RENDER_EXTERNAL_URL automatiquement.
    apiPublicUrl: (process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ''),
    timezone: process.env.BUSINESS_TIMEZONE ?? 'Africa/Lome',
    appSecret,
    encryptionKey,
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    storage: {
      driver,
      localDir: process.env.LOCAL_UPLOAD_DIR ?? './uploads',
      cloudinary,
    },
    paygateApiKey: process.env.PAYGATE_API_KEY?.trim() || undefined,
  };
  return cached;
}

/** Réservé aux tests : force la relecture de l'environnement. */
export function resetConfigCache() {
  cached = null;
}
