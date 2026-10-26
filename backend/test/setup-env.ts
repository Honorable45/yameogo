// Variables minimales pour les tests (aucun secret réel).
process.env.APP_SECRET ??= 'test-secret-test-secret-test-secret-0123456789';
process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');
process.env.BUSINESS_TIMEZONE ??= 'Africa/Lome';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://yameogo@localhost:5436/yameogo_test?schema=public';
process.env.NODE_ENV = 'test';
process.env.LOCAL_UPLOAD_DIR ??= require('node:os').tmpdir() + '/yameogo-test-uploads';
// Jamais de vrai compte Cloudinary pendant les tests : photos sur disque temporaire.
delete process.env.CLOUDINARY_URL;
