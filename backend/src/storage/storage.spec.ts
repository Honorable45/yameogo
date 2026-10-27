import { loadConfig, resetConfigCache } from '../config/env';
import { CryptoService } from '../common/crypto.service';
import { StorageService } from './storage.service';

const R2 = {
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_ACCESS_KEY_ID: 'cle-test',
  R2_SECRET_ACCESS_KEY: 'secret-test',
  R2_BUCKET: 'yameogo-images',
  R2_PUBLIC_URL: 'https://images.yameogo.test/',
};

describe('Stockage Cloudflare R2', () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of [...Object.keys(R2), 'R2_PRIVATE_BUCKET']) delete process.env[k];
    Object.assign(process.env, saved);
    resetConfigCache();
  });

  function service() {
    resetConfigCache();
    return new StorageService(new CryptoService());
  }

  it('reste en stockage local sans R2_BUCKET', () => {
    const storage = service();
    expect(loadConfig().storage.driver).toBe('local');
    expect(storage.publicUrl('products/2026-10/abc')).toMatch(/\/uploads\/products\/2026-10\/abc-1600\.webp$/);
  });

  it('refuse le stockage local éphémère en production', () => {
    process.env.NODE_ENV = 'production';
    resetConfigCache();
    expect(() => loadConfig()).toThrow('R2_BUCKET doit être renseigné en production');
  });

  it('exige les autres variables R2 dès qu’un bucket est indiqué', () => {
    process.env.R2_BUCKET = 'yameogo-images';
    resetConfigCache();
    expect(() => loadConfig()).toThrow('R2_ACCOUNT_ID');
    Object.assign(process.env, R2, { R2_PUBLIC_URL: 'http://pas-https.test' });
    resetConfigCache();
    expect(() => loadConfig()).toThrow('R2_PUBLIC_URL');
  });

  it('sert les images depuis l’adresse publique du bucket, en plusieurs largeurs', () => {
    Object.assign(process.env, R2);
    const storage = service();
    expect(loadConfig().storage.r2).toMatchObject({ endpoint: 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com', bucket: 'yameogo-images', privateBucket: null });
    expect(storage.publicUrl('products/2026-10/abc')).toBe('https://images.yameogo.test/products/2026-10/abc-1600.webp');
  });
});
