import { loadConfig, resetConfigCache } from '../config/env';
import { CryptoService } from '../common/crypto.service';
import { StorageService } from './storage.service';

describe('Stockage Cloudinary', () => {
  const previous = process.env.CLOUDINARY_URL;
  afterEach(() => {
    if (previous === undefined) delete process.env.CLOUDINARY_URL;
    else process.env.CLOUDINARY_URL = previous;
    resetConfigCache();
  });

  function service() {
    resetConfigCache();
    return new StorageService(new CryptoService());
  }

  it('reste en stockage local sans CLOUDINARY_URL', () => {
    delete process.env.CLOUDINARY_URL;
    const storage = service();
    expect(loadConfig().storage.driver).toBe('local');
    expect(storage.publicUrl('products/2026-10/abc')).toMatch(/\/uploads\/products\/2026-10\/abc-1600\.webp$/);
  });

  it('refuse une CLOUDINARY_URL mal formée', () => {
    process.env.CLOUDINARY_URL = 'https://api.cloudinary.com/demo';
    resetConfigCache();
    expect(() => loadConfig()).toThrow('CLOUDINARY_URL');
  });

  it('accepte la ligne entière copiée depuis Cloudinary', () => {
    process.env.CLOUDINARY_URL = 'CLOUDINARY_URL=cloudinary://123456:secret-test@yameogo-demo';
    resetConfigCache();
    expect(loadConfig().storage.cloudinary).toEqual({ apiKey: '123456', apiSecret: 'secret-test', cloudName: 'yameogo-demo' });
    expect(process.env.CLOUDINARY_URL).toBe('cloudinary://123456:secret-test@yameogo-demo');
  });

  it('sert les images publiques depuis le dossier yameogo du compte', () => {
    process.env.CLOUDINARY_URL = 'cloudinary://123456:secret-test@yameogo-demo';
    const storage = service();
    expect(loadConfig().storage.driver).toBe('cloudinary');
    expect(storage.publicUrl('phones/2026-10/abc')).toBe('https://res.cloudinary.com/yameogo-demo/image/upload/yameogo/phones/2026-10/abc.webp');
  });

  it('lit les fichiers privés par une URL signée de type authenticated', () => {
    process.env.CLOUDINARY_URL = 'cloudinary://123456:secret-test@yameogo-demo';
    const storage = service();
    const url = (storage as unknown as { privateCloudUrl: (k: string) => string }).privateCloudUrl.bind(storage);
    expect(url('private/receipts/2026-10/tok.pdf')).toMatch(/^https:\/\/res\.cloudinary\.com\/yameogo-demo\/raw\/authenticated\/s--[\w-]{8}--\/.*yameogo\/private\/receipts\/2026-10\/tok\.pdf$/);
    expect(url('private/requests/2026-10/tok.webp')).toMatch(/^https:\/\/res\.cloudinary\.com\/yameogo-demo\/image\/authenticated\/s--[\w-]{8}--\/.*yameogo\/private\/requests\/2026-10\/tok\.webp$/);
  });
});
