import type * as CloudinarySdk from 'cloudinary';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { CryptoService } from '../common/crypto.service';
import { loadConfig } from '../config/env';

/** Largeurs générées pour chaque image publique (WebP) en stockage local. Cloudinary redimensionne à la volée. */
export const IMAGE_WIDTHS = [480, 960, 1600] as const;
/** Dossier racine du compte Cloudinary. */
const CLOUDINARY_ROOT = 'yameogo';
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif']);

export type PublicFolder = 'products' | 'site';
export type PrivateFolder = 'receipts';

export interface StoredImage {
  key: string;
  width: number;
  height: number;
}

/**
 * Stockage des fichiers.
 * - Une image est décodée par sharp : un fichier qui n'est pas réellement une image est rejeté
 *   (le type annoncé par le navigateur n'est jamais pris en compte).
 * - Les images sont réencodées en WebP, ce qui supprime les métadonnées (EXIF, position GPS).
 * - Fichiers publics (photos du catalogue) : servis directement.
 *   Fichiers privés (justificatifs de dépenses) : préfixe « private/ »,
 *   servis uniquement par une route authentifiée.
 * - Pilote « local » (disque, développement) ou « cloudinary » (production).
 *   Sur Cloudinary, les fichiers privés sont de type « authenticated » : accessibles seulement par URL signée,
 *   lue par l'API elle-même ; leur adresse n'est jamais transmise au navigateur.
 */
@Injectable()
export class StorageService {
  private readonly config = loadConfig();
  private readonly logger = new Logger(StorageService.name);
  private readonly cloud = this.config.storage.cloudinary;
  // Chargé seulement après loadConfig() : le SDK lit CLOUDINARY_URL dès son import et plante si elle est mal formée.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private readonly sdk = this.cloud ? (require('cloudinary') as typeof CloudinarySdk).v2 : null;

  constructor(private readonly crypto: CryptoService) {
    if (this.cloud) {
      this.sdk!.config({ cloud_name: this.cloud.cloudName, api_key: this.cloud.apiKey, api_secret: this.cloud.apiSecret, secure: true, analytics: false });
    } else if (this.config.nodeEnv === 'production') {
      this.logger.warn('CLOUDINARY_URL absente : les images sont stockées sur le disque du serveur et seront perdues au prochain déploiement.');
    }
  }

  get localRoot() {
    return resolve(this.config.storage.localDir);
  }

  /** Image publique déclinée en plusieurs largeurs. Renvoie la clé de base. */
  async savePublicImage(buffer: Buffer, folder: PublicFolder): Promise<StoredImage> {
    const meta = await this.inspectImage(buffer);
    const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${this.crypto.randomToken(12)}`;
    let width = meta.width ?? 0;
    let height = meta.height ?? 0;
    if (this.cloud) {
      // Une seule version, la plus grande : Cloudinary sert ensuite la largeur demandée.
      const { data, info } = await sharp(buffer).rotate().resize({ width: IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1], withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
      await this.cloudUpload(data, `${CLOUDINARY_ROOT}/${key}`, 'image', 'upload');
      return { key, width: info.width, height: info.height };
    }
    for (const w of IMAGE_WIDTHS) {
      const { data, info } = await sharp(buffer)
        .rotate() // applique l'orientation EXIF avant de supprimer les métadonnées
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      await this.put(`${key}-${w}.webp`, data, 'image/webp');
      width = info.width;
      height = info.height;
    }
    return { key, width, height };
  }

  /** Fichier privé : image (réencodée) ou PDF (justificatif). Renvoie la clé complète du fichier. */
  async savePrivateFile(buffer: Buffer, folder: PrivateFolder, allowPdf = false): Promise<string> {
    const base = `private/${folder}/${new Date().toISOString().slice(0, 7)}/${this.crypto.randomToken(16)}`;
    if (allowPdf && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
      this.assertSize(buffer);
      await this.put(`${base}.pdf`, buffer, 'application/pdf');
      return `${base}.pdf`;
    }
    await this.inspectImage(buffer);
    const data = await sharp(buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    await this.put(`${base}.webp`, data, 'image/webp');
    return `${base}.webp`;
  }

  async readPrivateFile(key: string): Promise<{ data: Buffer; contentType: string }> {
    if (!/^private\/[a-z]+\/\d{4}-\d{2}\/[A-Za-z0-9_-]+\.(webp|pdf)$/.test(key)) throw new NotFoundException();
    const contentType = key.endsWith('.pdf') ? 'application/pdf' : 'image/webp';
    try {
      if (this.cloud) {
        const res = await fetch(this.privateCloudUrl(key));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { data: Buffer.from(await res.arrayBuffer()), contentType };
      }
      return { data: await readFile(join(this.localRoot, key)), contentType };
    } catch {
      throw new NotFoundException('Fichier introuvable.');
    }
  }

  /** URL publique de la plus grande déclinaison (le frontend dérive les autres largeurs). */
  publicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    if (this.cloud) return `https://res.cloudinary.com/${this.cloud.cloudName}/image/upload/${CLOUDINARY_ROOT}/${key}.webp`;
    return `${this.config.apiPublicUrl}/uploads/${key}-${IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]}.webp`;
  }

  async removePublicImage(key: string) {
    if (this.cloud) {
      try {
        await this.sdk!.uploader.destroy(`${CLOUDINARY_ROOT}/${key}`, { resource_type: 'image', type: 'upload', invalidate: true });
      } catch (err) {
        this.logger.warn(`Suppression impossible de ${key} sur Cloudinary : ${(err as Error).message}`);
      }
      return;
    }
    for (const w of IMAGE_WIDTHS) await this.removeLocalFile(`${key}-${w}.webp`);
  }

  private async removeLocalFile(file: string) {
    try {
      await unlink(join(this.localRoot, file));
    } catch (err) {
      this.logger.warn(`Suppression impossible de ${file} : ${(err as Error).message}`);
    }
  }

  /** URL signée et temporaire d'un fichier privé sur Cloudinary (utilisée uniquement côté serveur). */
  private privateCloudUrl(key: string) {
    const pdf = key.endsWith('.pdf');
    // Les fichiers « raw » (PDF) gardent leur extension dans l'identifiant ; les images non.
    const publicId = `${CLOUDINARY_ROOT}/${pdf ? key : key.replace(/\.webp$/, '')}`;
    return this.sdk!.url(publicId, {
      resource_type: pdf ? 'raw' : 'image',
      type: 'authenticated',
      sign_url: true,
      secure: true,
      ...(pdf ? {} : { format: 'webp' }),
    });
  }

  private cloudUpload(data: Buffer, publicId: string, resourceType: 'image' | 'raw', type: 'upload' | 'authenticated') {
    return new Promise<void>((done, fail) => {
      this.sdk!.uploader
        .upload_stream({ public_id: publicId, resource_type: resourceType, type, overwrite: false, unique_filename: false }, (err) => (err ? fail(new Error(err.message)) : done()))
        .end(data);
    });
  }

  private assertSize(buffer: Buffer) {
    if (!buffer?.length) throw new BadRequestException('Fichier vide.');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('Fichier trop lourd (8 Mo maximum).');
  }

  private async inspectImage(buffer: Buffer) {
    this.assertSize(buffer);
    let meta: sharp.Metadata;
    try {
      meta = await sharp(buffer).metadata();
    } catch {
      throw new BadRequestException('Le fichier envoyé n’est pas une image valide.');
    }
    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
      throw new BadRequestException('Format non accepté. Utilisez une image JPEG, PNG, WebP ou HEIC.');
    }
    if ((meta.width ?? 0) < 200 || (meta.height ?? 0) < 200) {
      throw new BadRequestException('Image trop petite (200 × 200 pixels minimum).');
    }
    if ((meta.width ?? 0) * (meta.height ?? 0) > 50_000_000) {
      throw new BadRequestException('Image trop grande (50 mégapixels maximum).');
    }
    return meta;
  }

  private async put(file: string, data: Buffer, contentType: string) {
    if (this.cloud) {
      const pdf = contentType === 'application/pdf';
      const isPrivate = file.startsWith('private/');
      await this.cloudUpload(data, `${CLOUDINARY_ROOT}/${pdf ? file : file.replace(/\.webp$/, '')}`, pdf ? 'raw' : 'image', isPrivate ? 'authenticated' : 'upload');
      return;
    }
    const target = join(this.localRoot, file);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, data);
  }
}
