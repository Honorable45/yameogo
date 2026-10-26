/**
 * COPIE DES PHOTOS DU DISQUE DE L'API VERS CLOUDFLARE R2 — à lancer AVANT d'activer R2 sur le serveur.
 *
 *   pnpm storage:copy-to-r2 https://yameogo.onrender.com
 *
 * Les photos téléversées tant que R2_BUCKET n'était pas renseigné sur le serveur sont sur son disque,
 * effacé à chaque déploiement. Ce script :
 * - télécharge chaque photo du catalogue (3 largeurs) depuis l'adresse publique de l'API et la dépose dans R2
 *   sous la même clé (rien à changer en base pour le catalogue) ;
 * - fait de même pour le logo et les photos du site, puis remplace leur adresse par celle de R2.
 * Une photo déjà présente dans R2 est ignorée : le script peut être relancé.
 *
 * Utilise DATABASE_URL et les variables R2_* du fichier .env (ou de l'environnement).
 */
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../src/config/env';
import { IMAGE_WIDTHS } from '../src/storage/storage.service';

const prisma = new PrismaClient();
const SETTINGS_FIELDS = ['logoUrl', 'heroImageUrl', 'phonesImageUrl', 'shopImageUrl'] as const;

async function main() {
  const source = process.argv[2]?.replace(/\/$/, '');
  if (!source?.startsWith('https://')) throw new Error('Indiquez l’adresse de l’API : pnpm storage:copy-to-r2 https://votre-api.onrender.com');
  const r2 = loadConfig().storage.r2;
  if (!r2) throw new Error('R2 non configuré : renseignez les variables R2_* dans .env.');
  const s3 = new S3Client({ region: 'auto', endpoint: r2.endpoint, credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey } });

  const exists = (file: string) =>
    s3.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: file })).then(
      () => true,
      () => false,
    );

  /** Copie les 3 largeurs d'une image ; renvoie false si elle n'est ni sur le disque de l'API ni dans R2. */
  const copy = async (key: string) => {
    let found = true;
    for (const w of IMAGE_WIDTHS) {
      const file = `${key}-${w}.webp`;
      if (await exists(file)) continue;
      const res = await fetch(`${source}/uploads/${file}`);
      if (!res.ok) {
        found = false;
        continue;
      }
      const body = Buffer.from(await res.arrayBuffer());
      await s3.send(new PutObjectCommand({ Bucket: r2.bucket, Key: file, Body: body, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' }));
      console.log(`  → ${file}`);
    }
    return found;
  };

  const missing: string[] = [];
  const images = await prisma.productImage.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true, group: { select: { name: true } } } });
  console.log(`Catalogue : ${images.length} photo(s).`);
  for (const img of images) if (!(await copy(img.storageKey!))) missing.push(`${img.group.name} (${img.storageKey})`);

  const settings = await prisma.businessSettings.findUnique({ where: { id: 1 } });
  const prefix = `${source}/uploads/`;
  for (const field of SETTINGS_FIELDS) {
    const url = settings?.[field];
    if (!url?.startsWith(prefix)) continue;
    const key = url.slice(prefix.length).replace(/-\d+\.webp$/, '');
    if (!(await copy(key))) {
      missing.push(`${field} (${key})`);
      continue;
    }
    await prisma.businessSettings.update({ where: { id: 1 }, data: { [field]: `${r2.publicUrl}/${key}-${IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]}.webp` } });
    console.log(`Paramètres : ${field} pointe maintenant vers R2.`);
  }

  if (missing.length) {
    console.log(`\n⚠ Introuvables (déjà effacées du disque de l'API) — à téléverser de nouveau depuis l'admin :\n  ${missing.join('\n  ')}`);
  } else {
    console.log('\nToutes les photos sont dans R2. Ajoutez maintenant les variables R2_* sur le serveur et redéployez.');
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
