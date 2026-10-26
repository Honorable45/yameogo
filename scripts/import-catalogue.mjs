#!/usr/bin/env node
/**
 * Import du catalogue (accessoires et téléphones) depuis deux fichiers CSV et un dossier de photos.
 *
 * Passe par l'API, exactement comme l'administration : stock tracé (entrée initiale au coût indiqué),
 * photos vérifiées, nettoyées et envoyées sur le stockage configuré (Cloudinary en production).
 *
 *   node scripts/import-catalogue.mjs --api https://votre-api.onrender.com --dossier catalogue
 *   node scripts/import-catalogue.mjs --api … --dossier catalogue --essai    (vérifie sans rien créer)
 *
 * Identifiants : variables THS_EMAIL / THS_PASSWORD, sinon demandés au clavier (compte Responsable).
 * Tout le fichier est vérifié avant la première écriture ; le script peut être relancé sans créer de doublon
 * (accessoire : même nom déjà présent ; téléphone : ligne déjà importée, notée dans <dossier>/.importes.json).
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const CONDITIONS = { neuf: 'NEW', venu: 'IMPORTED', occasion: 'USED' };
const GRADES = { 'comme neuf': 'LIKE_NEW', 'tres bon': 'VERY_GOOD', bon: 'GOOD', correct: 'FAIR' };

// ─── Arguments
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = args.includes('--essai');
const API = (arg('api') ?? process.env.THS_API ?? '').replace(/\/$/, '');
const DIR = resolve(arg('dossier') ?? 'catalogue');
if (!/^https?:\/\//.test(API)) fail('Indiquez l’adresse de l’API : --api https://votre-api.onrender.com');
if (!existsSync(DIR)) fail(`Dossier introuvable : ${DIR}`);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

// ─── Lecture des CSV (séparateur « ; » ou « , », guillemets, BOM d'Excel)
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows.filter((r) => r.some((v) => v.trim()));
  if (!header) return [];
  const keys = header.map((h) => normalize(h).replace(/\s+/g, '_'));
  return data.map((r, i) => ({ line: i + 2, ...Object.fromEntries(keys.map((k, j) => [k, (r[j] ?? '').trim()])) }));
}

/** Minuscules sans accents : comparaisons tolérantes (« Très bon » = « tres bon »). */
function normalize(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** « 15 000 », « 15.000 F », « 15000 FCFA » → 15000. */
function amount(value, label, errors, where, { required = true } = {}) {
  const raw = String(value ?? '').replace(/fcfa|xof|cfa|f/gi, '').replace(/[\s  .]/g, '');
  if (!raw) {
    if (required) errors.push(`${where} : ${label} manquant`);
    return undefined;
  }
  if (!/^\d+$/.test(raw)) {
    errors.push(`${where} : ${label} invalide (« ${value} ») — nombre entier en FCFA`);
    return undefined;
  }
  return Number(raw);
}

async function photos(value, errors, where) {
  const names = String(value ?? '').split('|').map((s) => s.trim()).filter(Boolean);
  const files = [];
  for (const name of names) {
    const path = join(DIR, 'photos', name);
    if (!existsSync(path)) { errors.push(`${where} : photo introuvable « photos/${name} »`); continue; }
    if ((await stat(path)).size > MAX_PHOTO_BYTES) { errors.push(`${where} : photo trop lourde « ${name} » (8 Mo maximum)`); continue; }
    files.push(path);
  }
  return files;
}

// ─── API
let cookie = '';
async function api(method, path, body) {
  const headers = { 'X-Requested-With': 'yameogo', Cookie: cookie, Accept: 'application/json' };
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
  return { res, data };
}

async function uploadPhoto(path, kindPath, alt) {
  const form = new FormData();
  form.append('file', new Blob([await readFile(path)]), basename(path));
  if (alt) form.append('alt', alt.slice(0, 160));
  await api('POST', kindPath, form);
}

function ask(question, hidden = false) {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : '');
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); done(answer.trim()); });
  });
}

// ─── Programme
const email = process.env.THS_EMAIL ?? (await ask('E-mail du compte Responsable : '));
const password = process.env.THS_PASSWORD ?? (await ask('Mot de passe : ', true));
console.log(`\nConnexion à ${API}… (le premier appel peut prendre ~1 min si l’API était en veille)`);
try {
  const { res } = await api('POST', '/auth/login', { email, password });
  cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('ymg_session=')) ?? '';
  if (!cookie) fail('Connexion refusée : aucun cookie de session reçu.');
} catch (err) {
  fail(`Connexion impossible : ${err.message}`);
}

const [{ data: categories }, { data: brands }] = await Promise.all([api('GET', '/categories?kind=ACCESSORY'), api('GET', '/brands')]);
const categoryByName = new Map(categories.map((c) => [normalize(c.name), c]));
const brandByName = new Map(brands.map((b) => [normalize(b.name), b]));

const errors = [];
const accessories = [];
const phones = [];

// Accessoires
const accessoriesFile = join(DIR, 'accessoires.csv');
if (existsSync(accessoriesFile)) {
  for (const r of parseCsv(await readFile(accessoriesFile, 'utf8'))) {
    const where = `accessoires.csv ligne ${r.line}`;
    const category = categoryByName.get(normalize(r.categorie));
    if (!r.nom || r.nom.length < 2) errors.push(`${where} : nom manquant`);
    if (!category) errors.push(`${where} : catégorie inconnue « ${r.categorie} » (au choix : ${categories.map((c) => c.name).join(', ')})`);
    const item = {
      name: r.nom,
      categoryId: category?.id,
      salePrice: amount(r.prix_vente, 'prix de vente', errors, where),
      initialStock: amount(r.stock, 'stock', errors, where),
      initialUnitCost: amount(r.cout_achat, 'coût d’achat', errors, where, { required: false }),
      description: r.description || undefined,
      files: await photos(r.photos, errors, where),
      where,
    };
    if (item.initialStock > 0 && item.initialUnitCost === undefined) errors.push(`${where} : coût d’achat unitaire manquant (nécessaire pour le stock et les marges)`);
    if (!item.files.length) errors.push(`${where} : au moins une photo est nécessaire`);
    accessories.push(item);
  }
}

// Téléphones
const phonesFile = join(DIR, 'telephones.csv');
if (existsSync(phonesFile)) {
  for (const r of parseCsv(await readFile(phonesFile, 'utf8'))) {
    const where = `telephones.csv ligne ${r.line}`;
    const brand = brandByName.get(normalize(r.marque));
    const condition = CONDITIONS[normalize(r.etat)];
    const grade = r.grade ? GRADES[normalize(r.grade).replace(/ etat$/, '')] : condition === 'NEW' ? 'LIKE_NEW' : undefined;
    if (!brand) errors.push(`${where} : marque inconnue « ${r.marque} » (au choix : ${brands.map((b) => b.name).join(', ')})`);
    if (!r.modele) errors.push(`${where} : modèle manquant`);
    if (!condition) errors.push(`${where} : état « ${r.etat} » invalide (Neuf, Venu ou Occasion)`);
    if (!grade) errors.push(`${where} : grade « ${r.grade} » invalide (Comme neuf, Très bon, Bon ou Correct)`);
    const battery = r.batterie ? Number(r.batterie.replace('%', '').trim()) : undefined;
    if (battery !== undefined && !(battery >= 0 && battery <= 100)) errors.push(`${where} : batterie invalide « ${r.batterie} » (0 à 100)`);
    const storage = r.stockage_go ? Number(r.stockage_go.replace(/go|gb/i, '').trim()) : undefined;
    if (storage !== undefined && !Number.isInteger(storage)) errors.push(`${where} : stockage invalide « ${r.stockage_go} »`);
    const warranty = r.garantie_mois ? Number(r.garantie_mois) : 0;
    const model = brand?.models.find((m) => normalize(m.name) === normalize(r.modele));
    const files = await photos(r.photos, errors, where);
    if (!files.length) errors.push(`${where} : au moins une photo réelle est nécessaire pour mettre le téléphone en vente`);
    phones.push({
      key: createHash('sha256').update(JSON.stringify({ ...r, line: undefined })).digest('hex').slice(0, 16),
      body: {
        brandId: brand?.id,
        phoneModelId: model?.id ?? null,
        modelName: r.modele,
        condition,
        grade,
        storageGb: storage ?? null,
        color: r.couleur || null,
        batteryHealth: condition === 'NEW' ? null : (battery ?? null),
        knownDefects: r.defauts || null,
        includedAccessories: r.inclus || null,
        purchasePrice: amount(r.prix_achat, 'prix d’achat', errors, where),
        salePrice: amount(r.prix_vente, 'prix de vente', errors, where),
        warrantyMonths: warranty,
        acquiredAt: r.date_achat ? new Date(r.date_achat.split('/').reverse().join('-')).toISOString() : new Date().toISOString(),
        imei: r.imei || null,
      },
      files,
      where,
    });
  }
}

if (!accessories.length && !phones.length) fail(`Aucune ligne trouvée : ajoutez accessoires.csv et/ou telephones.csv dans ${DIR}`);
if (errors.length) {
  console.error(`\n✖ ${errors.length} problème(s) à corriger — rien n’a été créé :\n`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}
console.log(`✔ Fichiers valides : ${accessories.length} accessoire(s), ${phones.length} téléphone(s).`);
if (DRY_RUN) {
  console.log('Mode essai : rien n’a été créé. Relancez sans --essai pour importer.');
  process.exit(0);
}

// ─── Création
const journalPath = join(DIR, '.importes.json');
const journal = existsSync(journalPath) ? JSON.parse(await readFile(journalPath, 'utf8')) : {};
const report = { created: 0, skipped: 0, failed: 0 };

for (const a of accessories) {
  try {
    const { data: existing } = await api('GET', `/products?kind=ACCESSORY&q=${encodeURIComponent(a.name)}&pageSize=50`);
    if (existing.items.some((p) => normalize(p.name) === normalize(a.name))) {
      console.log(`  = ${a.name} : déjà présent, ignoré`);
      report.skipped++;
      continue;
    }
    const { data: product } = await api('POST', '/products', {
      kind: 'ACCESSORY',
      name: a.name,
      categoryId: a.categoryId,
      salePrice: a.salePrice,
      initialStock: a.initialStock,
      initialUnitCost: a.initialUnitCost,
      description: a.description,
      published: true,
    });
    for (const f of a.files) await uploadPhoto(f, `/products/${product.id}/images`, a.name);
    console.log(`  + ${a.name} (${a.files.length} photo(s))`);
    report.created++;
  } catch (err) {
    console.error(`  ✖ ${a.where} — ${a.name} : ${err.message}`);
    report.failed++;
  }
}

for (const p of phones) {
  const label = `${p.body.modelName}${p.body.storageGb ? ` ${p.body.storageGb} Go` : ''}`;
  if (journal[p.key]) {
    console.log(`  = ${label} : déjà importé (${journal[p.key]}), ignoré`);
    report.skipped++;
    continue;
  }
  try {
    const { data: phone } = await api('POST', '/used-phones', p.body);
    // Noté tout de suite : une relance ne recrée pas ce téléphone, même si une photo échoue ensuite.
    journal[p.key] = phone.reference;
    await writeFile(journalPath, JSON.stringify(journal, null, 2));
    for (const f of p.files) await uploadPhoto(f, `/used-phones/${phone.id}/images`, label);
    await api('POST', `/used-phones/${phone.id}/status`, { status: 'AVAILABLE', note: 'Import du catalogue' });
    console.log(`  + ${label} — ${phone.reference} (${p.files.length} photo(s), en vente)`);
    report.created++;
  } catch (err) {
    console.error(`  ✖ ${p.where} — ${label} : ${err.message}`);
    report.failed++;
  }
}

console.log(`\nTerminé : ${report.created} créé(s), ${report.skipped} ignoré(s), ${report.failed} en échec.`);
if (report.failed) process.exit(1);
