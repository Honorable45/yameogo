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
    driver: 'local' | 'r2';
    localDir: string;
    r2: { endpoint: string; bucket: string; privateBucket: string | null; accessKeyId: string; secretAccessKey: string; publicUrl: string } | null;
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

  // Images sur Cloudflare R2 dès que R2_BUCKET est renseigné ; sinon sur le disque (développement).
  const r2Bucket = process.env.R2_BUCKET?.trim();
  let r2: AppConfig['storage']['r2'] = null;
  if (r2Bucket) {
    const accountId = required('R2_ACCOUNT_ID');
    if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('R2_ACCOUNT_ID doit être l’identifiant de compte Cloudflare (32 caractères hexadécimaux).');
    const publicUrl = required('R2_PUBLIC_URL').replace(/\/$/, '');
    if (!/^https:\/\//.test(publicUrl)) throw new Error('R2_PUBLIC_URL doit être l’adresse publique du bucket (https://pub-….r2.dev ou votre domaine).');
    r2 = {
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      bucket: r2Bucket,
      privateBucket: process.env.R2_PRIVATE_BUCKET?.trim() || null,
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
      publicUrl,
    };
  }
  const driver = r2 ? 'r2' : 'local';

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
      r2,
    },
    paygateApiKey: process.env.PAYGATE_API_KEY?.trim() || undefined,
  };
  return cached;
}

/** Réservé aux tests : force la relecture de l'environnement. */
export function resetConfigCache() {
  cached = null;
}
