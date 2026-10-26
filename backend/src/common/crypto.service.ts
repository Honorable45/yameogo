import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { loadConfig } from '../config/env';

// Alphabet sans caractères ambigus (0/O, 1/I/L) pour les codes saisis à la main.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

@Injectable()
export class CryptoService {
  private readonly config = loadConfig();

  /** Empreinte HMAC-SHA256 (hex) : sessions, codes d'avis, IMEI. */
  hmac(value: string, purpose: string): string {
    return createHmac('sha256', this.config.appSecret).update(`${purpose}:${value}`).digest('hex');
  }

  /** Comparaison à temps constant de deux secrets (via leurs empreintes, de longueur fixe). */
  safeEqual(a: string, b: string): boolean {
    return timingSafeEqual(Buffer.from(this.hmac(a, 'cmp'), 'hex'), Buffer.from(this.hmac(b, 'cmp'), 'hex'));
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  /** Code lisible, robuste (31^n combinaisons), ex. 10 caractères ≈ 49 bits. */
  randomCode(length = 10): string {
    let out = '';
    for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    return out;
  }

  /** Chiffrement AES-256-GCM. Format : iv.tag.ciphertext (base64url). */
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.config.encryptionKey, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
  }

  decrypt(payload: string): string {
    const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.config.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
}

/** Normalise un IMEI / numéro de série : chiffres et lettres uniquement, en majuscules. */
export function normalizeIdentifier(value: string): string {
  return value.replace(/[^0-9a-z]/gi, '').toUpperCase();
}
