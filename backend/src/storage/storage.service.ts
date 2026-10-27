import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { CryptoService } from '../common/crypto.service';
import { loadConfig } from '../config/env';

/** Largeurs générées pour chaque image publique (WebP) : le site sert la plus adaptée à l'écran. */
export const IMAGE_WIDTHS = [480, 960, 1600] as const;
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
 * - Les images sont réencodées en WebP (480, 960 et 1600 px), ce qui supprime les métadonnées (EXIF, position GPS).
 * - Fichiers publics (photos du catalogue) : servis directement, mis en cache un an (noms uniques).
 *   Fichiers privés (justificatifs de dépenses) : préfixe « private/ », servis uniquement par une route authentifiée.
 * - Pilote « local » (disque, développement) ou « r2 » (Cloudflare R2, compatible S3 ; production).
 *   Sur R2, les fichiers privés vont dans un bucket privé (R2_PRIVATE_BUCKET) ; à défaut, dans le bucket public
 *   sous un nom aléatoire de 128 bits, jamais communiqué au navigateur.
 */
@Injectable()
export class StorageService {
  private readonly config = loadConfig();
  private readonly logger = new Logger(StorageService.name);
  private readonly r2 = this.config.storage.r2;
  private readonly s3 = this.r2
    ? new S3Client({ region: 'auto', endpoint: this.r2.endpoint, credentials: { accessKeyId: this.r2.accessKeyId, secretAccessKey: this.r2.secretAccessKey } })
    : null;

  constructor(private readonly crypto: CryptoService) {
    if (this.r2 && !this.r2.privateBucket) {
      this.logger.warn('R2_PRIVATE_BUCKET absent : les justificatifs de dépenses sont rangés dans le bucket public (sous un nom aléatoire). Un bucket privé est recommandé.');
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
      if (this.s3) {
        const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucketFor(key), Key: key }));
        return { data: Buffer.from(await res.Body!.transformToByteArray()), contentType };
      }
      return { data: await readFile(join(this.localRoot, key)), contentType };
    } catch {
      throw new NotFoundException('Fichier introuvable.');
    }
  }

  /** URL publique de la plus grande déclinaison (le site dérive les autres largeurs). */
  publicUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    const base = this.r2 ? this.r2.publicUrl : `${this.config.apiPublicUrl}/uploads`;
    return `${base}/${key}-${IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]}.webp`;
  }

  async removePublicImage(key: string) {
    for (const w of IMAGE_WIDTHS) await this.removeFile(`${key}-${w}.webp`);
  }

  private async removeFile(file: string) {
    try {
      if (this.s3) await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketFor(file), Key: file }));
      else await unlink(join(this.localRoot, file));
    } catch (err) {
      this.logger.warn(`Suppression impossible de ${file} : ${(err as Error).message}`);
    }
  }

  private bucketFor(file: string) {
    return file.startsWith('private/') && this.r2!.privateBucket ? this.r2!.privateBucket : this.r2!.bucket;
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
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketFor(file),
          Key: file,
          Body: data,
          ContentType: contentType,
          CacheControl: file.startsWith('private/') ? 'private, no-store' : 'public, max-age=31536000, immutable',
        }),
      );
      return;
    }
    const target = join(this.localRoot, file);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, data);
  }
}
