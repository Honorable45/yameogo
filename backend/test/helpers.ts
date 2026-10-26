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
  agents: Record<'manager' | 'technician' | 'seller', ReturnType<typeof request.agent>>;
  ids: { brand: string; model: string; type: string; accCategory: string; partCategory: string; technician: string };
}

export async function createFixture(): Promise<Fixture> {
  const prisma = new PrismaClient();
  await resetDatabase(prisma);

  const passwordHash = await hash(PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const users: [string, Role][] = [
    ['manager@test.local', 'MANAGER'],
    ['tech@test.local', 'TECHNICIAN'],
    ['seller@test.local', 'SELLER'],
  ];
  for (const [email, role] of users) await prisma.user.create({ data: { email, name: role, role, passwordHash } });
  const technician = await prisma.user.findUniqueOrThrow({ where: { email: 'tech@test.local' } });

  const brand = await prisma.brand.create({ data: { name: 'Apple', slug: 'apple' } });
  const model = await prisma.phoneModel.create({ data: { brandId: brand.id, name: 'iPhone 11', slug: 'iphone-11' } });
  const type = await prisma.repairType.create({ data: { name: 'Écran cassé', slug: 'ecran-casse' } });
  const accCategory = await prisma.category.create({ data: { name: 'Câbles', slug: 'cables', kind: 'ACCESSORY' } });
  const partCategory = await prisma.category.create({ data: { name: 'Écrans', slug: 'pieces-ecrans', kind: 'PART' } });
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
    technician: await login('tech@test.local'),
    seller: await login('seller@test.local'),
  };
  return { app, prisma, agents, ids: { brand: brand.id, model: model.id, type: type.id, accCategory: accCategory.id, partCategory: partCategory.id, technician: technician.id } };
}

/** En-tête anti-CSRF exigé sur toute requête modifiante authentifiée. */
export const CSRF = { 'X-Requested-With': 'yameogo' };

export async function createProduct(f: Fixture, data: { name: string; price: number; stock: number; cost: number; kind?: 'ACCESSORY' | 'PART' }) {
  const res = await f.agents.manager
    .post('/products')
    .set(CSRF)
    .send({
      kind: data.kind ?? 'ACCESSORY',
      name: data.name,
      categoryId: data.kind === 'PART' ? f.ids.partCategory : f.ids.accCategory,
      salePrice: data.price,
      initialStock: data.stock,
      initialUnitCost: data.cost,
    })
    .expect(201);
  return res.body as { id: string; sku: string };
}
