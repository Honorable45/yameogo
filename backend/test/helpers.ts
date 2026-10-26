import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import { PrismaClient, Role } from '@prisma/client';
import { execSync } from 'node:child_process';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';

export const PASSWORD = 'Test-password-2026';

/** Base de test : migrations appliquées, toutes les tables vidées. */
export async function resetDatabase(prisma: PrismaClient) {
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'ignore' });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

export interface Fixture {
  app: NestExpressApplication;
  prisma: PrismaClient;
  agents: Record<'manager' | 'seller', ReturnType<typeof request.agent>>;
  ids: { brand: string; phoneCategory: string; accCategory: string };
}

export async function createFixture(): Promise<Fixture> {
  const prisma = new PrismaClient();
  await resetDatabase(prisma);

  const passwordHash = await hash(PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const users: [string, Role][] = [
    ['manager@test.local', 'MANAGER'],
    ['seller@test.local', 'SELLER'],
  ];
  for (const [email, role] of users) await prisma.user.create({ data: { email, name: role, role, passwordHash } });

  const brand = await prisma.brand.create({ data: { name: 'Samsung', slug: 'samsung' } });
  const phoneCategory = await prisma.category.create({ data: { name: 'Smartphones', slug: 'smartphones', kind: 'PHONE' } });
  const accCategory = await prisma.category.create({ data: { name: 'Câbles USB', slug: 'cables-usb', kind: 'ACCESSORY' } });
  await prisma.businessSettings.create({ data: { id: 1, payInStoreEnabled: true } });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
    return agent;
  };
  const agents = {
    manager: await login('manager@test.local'),
    seller: await login('seller@test.local'),
  };
  return { app, prisma, agents, ids: { brand: brand.id, phoneCategory: phoneCategory.id, accCategory: accCategory.id } };
}

/** En-tête anti-CSRF exigé sur toute requête modifiante authentifiée. */
export const CSRF = { 'X-Requested-With': 'yameogo' };

/** Accessoire à configuration unique ; renvoie l'article (la variante) créé. */
export async function createProduct(f: Fixture, data: { name: string; price: number; stock: number; cost: number }) {
  const res = await f.agents.manager
    .post('/catalog-groups')
    .set(CSRF)
    .send({ kind: 'ACCESSORY', name: data.name, categoryId: f.ids.accCategory, variants: [{ salePrice: data.price, stock: data.stock, unitCost: data.cost }] })
    .expect(201);
  const variant = res.body.variants[0] as { id: string; sku: string };
  return { id: variant.id, sku: variant.sku, groupId: res.body.id as string };
}
