/**
 * IMPORT D'UN CATALOGUE EXCEL (.xlsx) — smartphones, en une seule commande.
 *
 *   pnpm import:catalogue "/chemin/Catalogue.xlsx"
 *
 * Colonnes lues (1ʳᵉ feuille, ligne d'en-tête) : Modèle, Marque, Couleur(s), RAM, Stockage,
 * Prix d'achat estimé, Prix de vente conseillé, Photo 1/2/3 (images placées dans ces cellules), Remarques.
 *
 * - Une fiche par ligne ; une déclinaison par couleur × capacité, état « Neuf ».
 * - Prix : celui du fichier pour la plus petite capacité, puis un palier par capacité supérieure
 *   (même palier sur le coût d'achat, pour garder la marge).
 * - Stock initial : 1 pièce par déclinaison, valorisée au coût d'achat (mouvement « Stock initial »).
 * - Les lignes sans prix (ex. modèle « concept ») sont ignorées.
 * - Les produits de démonstration sont retirés (`--keep-demo` pour les garder).
 * - Une fiche dont le nom existe déjà est laissée telle quelle : la commande peut être relancée.
 *
 * Les photos passent par le stockage du site (disque en local, Cloudflare R2 si R2_BUCKET est renseigné).
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import sharp from 'sharp';
import { randomReference } from '../src/common/counters';
import { CryptoService } from '../src/common/crypto.service';
import { loadConfig } from '../src/config/env';
import { StorageService } from '../src/storage/storage.service';

const PRICE_STEPS = [0, 15000, 35000, 60000];
const STOCK_PER_VARIANT = 1;

// Teintes approximatives des couleurs Apple (modifiables ensuite dans l'admin).
const COLOR_HEX: Record<string, string> = {
  noir: '#1f2023',
  blanc: '#f3f3f0',
  bleu: '#3b6c9e',
  vert: '#c9dbc5',
  minuit: '#1f2229',
  'lumiere stellaire': '#f1ece4',
  rose: '#f5d6d6',
  mauve: '#b8afc9',
  rouge: '#ba0c2e',
  jaune: '#f3e9b5',
  sarcelle: '#9fc9c4',
  outremer: '#7d8fd6',
  'bleu brume': '#b7c7d6',
  sauge: '#b9c3a5',
  lavande: '#c9bcd9',
};

const prisma = new PrismaClient();

const slugify = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/* ---------- Lecture du fichier .xlsx (archive ZIP de fichiers XML), sans dépendance ---------- */

function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let eocd = buffer.length - 22;
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Ce fichier n’est pas un classeur Excel (.xlsx).');
  const count = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(p + 10);
    const size = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const name = buffer.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decode = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
const texts = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
const colIndex = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
// Attributs dans n'importe quel ordre ; balises avec ou sans préfixe d'espace de noms (selon le logiciel qui a écrit le fichier).
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
const relTargets = (xml: string) =>
  new Map([...xml.matchAll(/<Relationship\s[^>]*>/g)].map((m) => [attr(m[0], 'Id') ?? '', attr(m[0], 'Target') ?? ''] as [string, string]));
const resolvePath = (base: string, target: string) => {
  const parts = (target.startsWith('/') ? target.slice(1) : `${base}/${target}`).split('/');
  const out: string[] = [];
  for (const part of parts) part === '..' ? out.pop() : out.push(part);
  return out.join('/');
};

type Sheet = { rows: (string | null)[][]; images: Map<string, Buffer[]> };

function readFirstSheet(file: string): Sheet {
  const zip = unzip(readFileSync(file));
  const xml = (name: string) => zip.get(name)?.toString('utf8') ?? '';
  const shared = [...xml('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const firstSheetId = /<sheet [^>]*r:id="([^"]+)"/.exec(xml('xl/workbook.xml'))?.[1];
  const sheetPath = resolvePath('xl', relTargets(xml('xl/_rels/workbook.xml.rels')).get(firstSheetId ?? '') ?? 'worksheets/sheet1.xml');
  const sheetXml = xml(sheetPath);

  const rows: (string | null)[][] = [];
  for (const row of sheetXml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: (string | null)[] = [];
    for (const c of row[2].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+\d+)"/.exec(c[1])?.[1];
      if (!ref) continue;
      const type = /t="(\w+)"/.exec(c[1])?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? '')?.[1];
      cells[colIndex(ref)] = type === 's' && v !== undefined ? shared[Number(v)] : type === 'inlineStr' ? texts(c[2] ?? '') : v !== undefined ? decode(v) : null;
    }
    rows[Number(row[1]) - 1] = cells;
  }

  // Images ancrées dans les cellules : clé « ligne:colonne » (base 0).
  const images = new Map<string, Buffer[]>();
  const sheetDir = sheetPath.slice(0, sheetPath.lastIndexOf('/'));
  const sheetRels = relTargets(xml(`${sheetDir}/_rels/${sheetPath.split('/').pop()}.rels`));
  for (const target of sheetRels.values()) {
    if (!target.includes('drawing')) continue;
    const drawingPath = resolvePath(sheetDir, target);
    const drawingDir = drawingPath.slice(0, drawingPath.lastIndexOf('/'));
    const media = relTargets(xml(`${drawingDir}/_rels/${drawingPath.split('/').pop()}.rels`));
    for (const anchor of xml(drawingPath).matchAll(/<(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)[\s\S]*?<\/(?:\w+:)?(?:oneCellAnchor|twoCellAnchor)>/g)) {
      const from = /<(?:\w+:)?from>([\s\S]*?)<\/(?:\w+:)?from>/.exec(anchor[0])?.[1] ?? '';
      const row = /<(?:\w+:)?row>(\d+)</.exec(from)?.[1];
      const col = /<(?:\w+:)?col>(\d+)</.exec(from)?.[1];
      const embed = /r:embed="([^"]+)"/.exec(anchor[0])?.[1];
      const data = embed && zip.get(resolvePath(drawingDir, media.get(embed) ?? ''));
      if (row === undefined || col === undefined || !data) continue;
      const key = `${row}:${col}`;
      images.set(key, [...(images.get(key) ?? []), data]);
    }
  }
  return { rows, images };
}

/* ---------- Interprétation des lignes ---------- */

const norm = (v: string) => slugify(v).replace(/-/g, ' ');
const listOf = (v: string | null | undefined) => (v ?? '').split('/').map((s) => s.trim()).filter(Boolean);
const numberOf = (v: string | null | undefined) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

type Model = { line: number; name: string; brand: string; colors: string[]; ram: number | null; storages: number[]; cost: number; price: number; photos: Buffer[]; note: string };

function parse(sheet: Sheet): { models: Model[]; skipped: string[] } {
  const header = (sheet.rows[0] ?? []).map((h) => norm(h ?? ''));
  const find = (...words: string[]) => header.findIndex((h) => words.every((w) => h.includes(w)));
  const col = {
    name: find('modele'),
    brand: find('marque'),
    colors: find('couleur'),
    ram: find('ram'),
    storage: find('stockage'),
    cost: find('prix', 'achat'),
    price: find('prix', 'vente'),
    note: find('remarque'),
  };
  if (col.name < 0 || col.price < 0) throw new Error('Colonnes « Modèle » et « Prix de vente » introuvables dans la première feuille.');
  const photoCols = header.map((h, i) => (h.startsWith('photo') ? i : -1)).filter((i) => i >= 0);

  const models: Model[] = [];
  const skipped: string[] = [];
  sheet.rows.forEach((cells, r) => {
    if (r === 0 || !cells?.[col.name]) return;
    const name = String(cells[col.name]).trim();
    const price = numberOf(cells[col.price]);
    const storages = listOf(cells[col.storage]).map(numberOf).filter((n): n is number => n !== null);
    const colors = listOf(cells[col.colors]).filter((c) => !/confirmer/i.test(c));
    if (!price || !storages.length || !colors.length) {
      skipped.push(`${name} (ligne ${r + 1}) : prix, couleurs ou capacités non renseignés`);
      return;
    }
    models.push({
      line: r + 1,
      name,
      brand: String(cells[col.brand] ?? '').trim(),
      colors,
      ram: numberOf(cells[col.ram]),
      storages: [...new Set(storages)].sort((a, b) => a - b),
      cost: numberOf(cells[col.cost]) ?? 0,
      price,
      photos: photoCols.flatMap((c) => sheet.images.get(`${r}:${c}`) ?? []),
      note: String(cells[col.note] ?? '').trim(),
    });
  });
  return { models, skipped };
}

/* ---------- Écriture en base ---------- */

async function removeDemo() {
  const groups = await prisma.productGroup.findMany({
    where: { isDemo: true },
    include: { variants: { select: { id: true, _count: { select: { orderItems: true, purchaseItems: true, countLines: true } } } } },
  });
  for (const g of groups) {
    if (g.variants.some((v) => v._count.orderItems + v._count.purchaseItems + v._count.countLines > 0)) {
      await prisma.productGroup.update({ where: { id: g.id }, data: { status: 'ARCHIVED', published: false } });
      continue;
    }
    const ids = g.variants.map((v) => v.id);
    await prisma.inventoryMovement.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await prisma.productGroup.delete({ where: { id: g.id } });
  }
  return groups.length;
}

/** Les photos du fichier sont souvent de petites vignettes : agrandies sur fond blanc au minimum accepté par le site. */
async function prepare(photo: Buffer) {
  const { width = 0, height = 0 } = await sharp(photo).metadata();
  if (width >= 480 && height >= 480) return photo;
  const side = 480;
  const resized = await sharp(photo).resize({ width: side - 40, height: side - 40, fit: 'inside', kernel: 'lanczos3' }).toBuffer();
  return sharp({ create: { width: side, height: side, channels: 3, background: '#ffffff' } })
    .composite([{ input: resized, gravity: 'center' }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Indiquez le fichier : pnpm import:catalogue "/chemin/Catalogue.xlsx"');

  const config = loadConfig();
  const dbHost = /@([^:/]+)/.exec(process.env.DATABASE_URL ?? '')?.[1] ?? '';
  if (!config.storage.r2 && !['localhost', '127.0.0.1'].includes(dbHost)) {
    throw new Error('Base distante mais R2 non configuré : les photos resteraient sur ce PC. Renseignez R2_* avant d’importer en production.');
  }

  const { models, skipped } = parse(readFirstSheet(file));
  if (!models.length) throw new Error('Aucune ligne exploitable dans le fichier.');

  if (!process.argv.includes('--keep-demo')) console.log(`Démo retirée : ${await removeDemo()} fiche(s).`);

  const storage = new StorageService(new CryptoService());
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'smartphones' } });
  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });

  for (const m of models) {
    if (await prisma.productGroup.findFirst({ where: { name: m.name, kind: 'PHONE', status: { not: 'ARCHIVED' } } })) {
      console.log(`= ${m.name} : existe déjà, laissé tel quel.`);
      continue;
    }
    const brand = m.brand
      ? await prisma.brand.upsert({ where: { slug: slugify(m.brand) }, update: {}, create: { name: m.brand, slug: slugify(m.brand) } })
      : null;
    let slug = slugify(m.name);
    for (let i = 2; await prisma.productGroup.findUnique({ where: { slug } }); i++) slug = `${slugify(m.name)}-${i}`;

    const specs = [
      ...(m.ram ? [{ label: 'Mémoire vive', value: `${m.ram} Go` }] : []),
      { label: 'Stockage', value: m.storages.map((s) => `${s} Go`).join(' / ') },
      { label: 'État', value: 'Neuf' },
    ];
    const group = await prisma.productGroup.create({
      data: {
        kind: 'PHONE',
        name: m.name,
        slug,
        brandId: brand?.id ?? null,
        categoryId: category.id,
        description: `${m.name} neuf, disponible en ${m.storages.map((s) => `${s} Go`).join(', ')}. Couleurs : ${m.colors.join(', ')}.`,
        specs,
      },
    });

    for (const [position, photo] of m.photos.entries()) {
      const stored = await storage.savePublicImage(await prepare(photo), 'products');
      await prisma.productImage.create({
        data: { groupId: group.id, storageKey: stored.key, width: stored.width, height: stored.height, alt: `${m.name} — ${['face', 'dos', 'profil'][position] ?? 'photo'}`, position },
      });
    }

    let position = 0;
    for (const color of m.colors) {
      for (const [i, storageGb] of m.storages.entries()) {
        const step = PRICE_STEPS[Math.min(i, PRICE_STEPS.length - 1)];
        const price = m.price + step;
        const cost = m.cost ? m.cost + step : 0;
        const sku = await randomReference('TEL', async (r) => Boolean(await prisma.product.findUnique({ where: { sku: r } })));
        await prisma.product.create({
          data: {
            groupId: group.id,
            kind: 'PHONE',
            categoryId: category.id,
            sku,
            slug: `${slug}-${sku.toLowerCase()}`,
            name: `${m.name} · ${color} · ${m.ram ? `${m.ram} Go / ` : ''}${storageGb} Go · Neuf`,
            color,
            colorHex: COLOR_HEX[norm(color)] ?? null,
            ramGb: m.ram,
            storageGb,
            condition: 'NEW',
            salePrice: price,
            stockQuantity: STOCK_PER_VARIANT,
            averageCost: cost,
            position: position++,
            movements: {
              create: { type: 'INITIAL', quantity: STOCK_PER_VARIANT, unitCost: cost, stockAfter: STOCK_PER_VARIANT, averageCostAfter: cost, reason: 'Import du catalogue Excel', userId: manager?.id ?? null },
            },
          },
        });
      }
    }
    console.log(`+ ${m.name} : ${m.colors.length * m.storages.length} déclinaison(s), ${m.photos.length} photo(s), à partir de ${m.price.toLocaleString('fr-FR')} FCFA.`);
  }
  for (const s of skipped) console.log(`- Ignoré : ${s}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
