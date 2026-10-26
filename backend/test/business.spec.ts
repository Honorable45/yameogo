import request from 'supertest';
import { createFixture, createProduct, CSRF, type Fixture } from './helpers';

jest.setTimeout(60_000);

let f: Fixture;
const product = (id: string) => f.prisma.product.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  f = await createFixture();
});
afterAll(async () => {
  await f.app.close();
  await f.prisma.$disconnect();
});

const checkout = (items: object[], extra: object = {}) =>
  request(f.app.getHttpServer())
    .post('/shop/orders')
    .send({ customerName: 'Client Test', customerPhone: '+22890000001', fulfillment: 'PICKUP', paymentPreference: 'PAY_IN_STORE', items, ...extra });

describe('Commandes et stock', () => {
  it('réserve à la commande, sort du stock à la remise au coût moyen, puis calcule la marge', async () => {
    const p = await createProduct(f, { name: 'Câble USB-C', price: 3000, stock: 10, cost: 1200 });
    const res = await checkout([{ productId: p.id, quantity: 3 }]).expect(201);
    expect(res.body.total).toBe(9000);

    let row = await product(p.id);
    expect(row.stockQuantity).toBe(10);
    expect(row.reservedQuantity).toBe(3);

    const order = await f.prisma.order.findUniqueOrThrow({ where: { number: res.body.number } });
    await f.agents.seller.post(`/orders/${order.id}/status`).set(CSRF).send({ status: 'CONFIRMED' }).expect(200);
    await f.agents.seller.post(`/orders/${order.id}/payments`).set(CSRF).send({ kind: 'PAYMENT', amount: 9000, method: 'CASH' }).expect(201);
    const done = await f.agents.manager.post(`/orders/${order.id}/status`).set(CSRF).send({ status: 'COMPLETED' }).expect(200);

    row = await product(p.id);
    expect(row.stockQuantity).toBe(7);
    expect(row.reservedQuantity).toBe(0);
    expect(done.body.items[0].unitCost).toBe(1200);
    expect(done.body.grossMargin).toBe(9000 - 3 * 1200);
    expect(done.body.paymentStatus).toBe('PAID');
  });

  it('ignore les prix envoyés par le navigateur', async () => {
    const p = await createProduct(f, { name: 'Coque', price: 4000, stock: 5, cost: 1500 });
    // Un prix, un total ou une remise injectés sont écartés : seul le catalogue fait foi.
    const res = await checkout([{ productId: p.id, quantity: 2, unitPrice: 1, lineTotal: 1 }], { total: 1, subtotal: 1 }).expect(201);
    expect(res.body.total).toBe(8000);
    const order = await f.prisma.order.findUniqueOrThrow({ where: { number: res.body.number }, include: { items: true } });
    expect(order.items[0].unitPrice).toBe(4000);
  });

  it('refuse la survente lors de commandes simultanées', async () => {
    const p = await createProduct(f, { name: 'Chargeur', price: 6500, stock: 3, cost: 3800 });
    const results = await Promise.all(Array.from({ length: 6 }, () => checkout([{ productId: p.id, quantity: 1 }])));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    const row = await product(p.id);
    expect(row.reservedQuantity).toBe(3);
    expect(row.stockQuantity).toBe(3);
  });

  it('libère la réservation à l’annulation et exige un remboursement si la commande a été payée', async () => {
    const p = await createProduct(f, { name: 'Écouteurs', price: 2500, stock: 4, cost: 1000 });
    const res = await checkout([{ productId: p.id, quantity: 2 }]).expect(201);
    const order = await f.prisma.order.findUniqueOrThrow({ where: { number: res.body.number } });
    await f.agents.seller.post(`/orders/${order.id}/payments`).set(CSRF).send({ kind: 'PAYMENT', amount: 2000, method: 'CASH' }).expect(201);
    await f.agents.seller.post(`/orders/${order.id}/status`).set(CSRF).send({ status: 'CANCELLED', note: 'test' }).expect(409);
    await f.agents.manager.post(`/orders/${order.id}/payments`).set(CSRF).send({ kind: 'REFUND', amount: 2000, method: 'CASH' }).expect(201);
    await f.agents.seller.post(`/orders/${order.id}/status`).set(CSRF).send({ status: 'CANCELLED', note: 'Client absent' }).expect(200);
    expect((await product(p.id)).reservedQuantity).toBe(0);
  });

  it('refuse un paiement supérieur au reste dû', async () => {
    const p = await createProduct(f, { name: 'Support', price: 5000, stock: 2, cost: 2500 });
    const res = await checkout([{ productId: p.id, quantity: 1 }]).expect(201);
    const order = await f.prisma.order.findUniqueOrThrow({ where: { number: res.body.number } });
    await f.agents.seller.post(`/orders/${order.id}/payments`).set(CSRF).send({ kind: 'PAYMENT', amount: 6000, method: 'CASH' }).expect(400);
  });
});

const PHONE = {
  kind: 'PHONE',
  name: 'Galaxy A56',
  brandName: 'Samsung',
  specs: [{ label: 'Écran', value: '6,7 pouces' }],
  variants: [
    { color: 'Noir', colorHex: '#111111', ramGb: 8, storageGb: 128, condition: 'NEW', salePrice: 150000, stock: 3, unitCost: 120000 },
    { color: 'Noir', colorHex: '#111111', ramGb: 8, storageGb: 256, condition: 'NEW', salePrice: 165000, stock: 2, unitCost: 130000 },
    { color: 'Bleu', colorHex: '#2f4a73', ramGb: 12, storageGb: 256, condition: 'NEW', salePrice: 185000, compareAtPrice: 199000, stock: 0 },
  ],
};

describe('Catalogue et variantes', () => {
  it('crée un smartphone avec ses configurations, chacune avec son prix et son stock', async () => {
    const created = await f.agents.manager.post('/catalog-groups').set(CSRF).send({ ...PHONE, categoryId: f.ids.phoneCategory }).expect(201);
    expect(created.body.variants.map((v: { label: string; salePrice: number; stockQuantity: number }) => [v.label, v.salePrice, v.stockQuantity])).toEqual([
      ['Noir · 8 Go / 128 Go · Neuf', 150000, 3],
      ['Noir · 8 Go / 256 Go · Neuf', 165000, 2],
      ['Bleu · 12 Go / 256 Go · Neuf', 185000, 0],
    ]);
    // Stock initial tracé et valorisé : sert au coût moyen et aux marges.
    const movement = await f.prisma.inventoryMovement.findFirstOrThrow({ where: { productId: created.body.variants[0].id } });
    expect(movement).toMatchObject({ type: 'INITIAL', quantity: 3, unitCost: 120000 });

    const pub = await request(f.app.getHttpServer()).get(`/shop/catalog/${created.body.slug}`).expect(200);
    expect(pub.body).toMatchObject({ brand: { name: 'Samsung' }, priceFrom: 150000, ramGbs: [8, 12], storageGbs: [128, 256], specs: [{ label: 'Écran', value: '6,7 pouces' }] });
    expect(pub.body.variants[2]).toMatchObject({ availability: 'OUT_OF_STOCK', price: 185000, compareAtPrice: 199000 });
    expect(JSON.stringify(pub.body)).not.toMatch(/averageCost|unitCost|stockQuantity/);
  });

  it('refuse les configurations en double, les prix barrés incohérents et une marque manquante', async () => {
    const base = { ...PHONE, name: 'Doublon', categoryId: f.ids.phoneCategory };
    await f.agents.manager.post('/catalog-groups').set(CSRF).send({ ...base, variants: [PHONE.variants[0], { ...PHONE.variants[0], color: 'noir' }] }).expect(400);
    await f.agents.manager.post('/catalog-groups').set(CSRF).send({ ...base, variants: [{ ...PHONE.variants[0], compareAtPrice: 150000 }] }).expect(400);
    await f.agents.manager.post('/catalog-groups').set(CSRF).send({ ...base, brandName: null }).expect(400);
    // Un accessoire n'a ni RAM, ni stockage, ni état : ces valeurs sont ignorées.
    const acc = await f.agents.manager
      .post('/catalog-groups')
      .set(CSRF)
      .send({ kind: 'ACCESSORY', name: 'Câble tressé', categoryId: f.ids.accCategory, optionName: 'Longueur', variants: [{ optionValue: '1 m', ramGb: 8, storageGb: 64, condition: 'NEW', salePrice: 3000 }, { optionValue: '2 m', salePrice: 4000 }] })
      .expect(201);
    expect(acc.body.variants[0]).toMatchObject({ ramGb: null, storageGb: null, condition: null, label: '1 m' });
  });

  it('répercute prix et stock sur le site ; archive une configuration déjà vendue au lieu de la supprimer', async () => {
    const created = await f.agents.manager.post('/catalog-groups').set(CSRF).send({ ...PHONE, name: 'Galaxy A36', categoryId: f.ids.phoneCategory }).expect(201);
    const [v1, v2, v3] = created.body.variants;
    await f.agents.seller.post('/orders/counter-sale').set(CSRF).send({ items: [{ productId: v2.id, quantity: 1 }], payments: [{ method: 'CASH', amount: 165000 }] }).expect(201);

    const body = (variants: object[]) => ({ ...PHONE, name: 'Galaxy A36', categoryId: f.ids.phoneCategory, variants });
    // Première entrée de stock sans coût connu : refusée.
    await f.agents.manager.put(`/catalog-groups/${created.body.id}`).set(CSRF).send(body([{ ...PHONE.variants[0], id: v1.id }, { ...PHONE.variants[1], id: v2.id, stock: 1 }, { ...PHONE.variants[2], id: v3.id, stock: 2 }])).expect(400);
    const updated = await f.agents.manager
      .put(`/catalog-groups/${created.body.id}`)
      .set(CSRF)
      // Nouveau prix sur la 1re configuration, stock ajouté sur la 3e, 2e (vendue) retirée de la liste.
      .send(body([{ ...PHONE.variants[0], id: v1.id, salePrice: 140000, stock: 3 }, { ...PHONE.variants[2], id: v3.id, stock: 2, unitCost: 150000 }]))
      .expect(200);
    const byId = Object.fromEntries(updated.body.variants.map((v: { id: string }) => [v.id, v]));
    expect(byId[v1.id]).toMatchObject({ salePrice: 140000, active: true });
    expect(byId[v2.id]).toMatchObject({ active: false });
    expect(byId[v3.id]).toMatchObject({ stockQuantity: 2, availability: 'LOW_STOCK' });

    const pub = await request(f.app.getHttpServer()).get(`/shop/catalog/${created.body.slug}`).expect(200);
    expect(pub.body.variants.map((v: { id: string }) => v.id)).toEqual([v1.id, v3.id]);
    expect(pub.body.priceFrom).toBe(140000);
    // Une fiche déjà vendue ne peut pas être supprimée : elle s'archive.
    await f.agents.manager.delete(`/catalog-groups/${created.body.id}`).set(CSRF).expect(409);
  });

  it('vérifie le panier avec les prix et stocks du serveur, et filtre le catalogue', async () => {
    const created = await f.agents.manager.post('/catalog-groups').set(CSRF).send({ ...PHONE, name: 'Galaxy A26', categoryId: f.ids.phoneCategory }).expect(201);
    const [v1, , v3] = created.body.variants;
    const server = request(f.app.getHttpServer());
    const cart = await server.post('/shop/cart/check').send({ items: [{ variantId: v1.id, quantity: 2 }, { variantId: v3.id, quantity: 1 }, { variantId: 'inconnu', quantity: 1 }] }).expect(200);
    expect(cart.body.lines[0]).toMatchObject({ available: true, unitPrice: 150000, name: 'Galaxy A26', label: 'Noir · 8 Go / 128 Go · Neuf', issue: null });
    expect(cart.body.lines[1]).toMatchObject({ available: false, issue: 'Épuisé' });
    expect(cart.body.lines[2]).toMatchObject({ available: false });

    const ram12 = await server.get('/shop/catalog?kind=PHONE&ram=12&q=A26').expect(200);
    expect(ram12.body.items.map((g: { name: string }) => g.name)).toEqual(['Galaxy A26']);
    const promo = await server.get('/shop/catalog?kind=PHONE&promo=1&q=A26&available=1').expect(200);
    // La seule configuration en promotion est épuisée : la fiche n'est pas proposée en promotion disponible…
    expect(promo.body.items[0]?.onSale ?? false).toBe(false);
    const facets = await server.get('/shop/catalog-facets?kind=PHONE').expect(200);
    expect(facets.body.rams).toEqual(expect.arrayContaining([8, 12]));
  });
});

describe('Avis clients', () => {
  it('exige un code, attend la remise de la commande et publie aussitôt', async () => {
    const server = request(f.app.getHttpServer());
    const p = await createProduct(f, { name: 'Coque avis', price: 4000, stock: 3, cost: 1500 });
    const res = await checkout([{ productId: p.id, quantity: 1 }]).expect(201);
    const order = await f.prisma.order.findUniqueOrThrow({ where: { number: res.body.number } });

    // Sans code : refusé.
    await server.post('/reviews').send({ rating: 5, comment: 'Super' }).expect(400);

    // Code créé automatiquement, stable d'un affichage à l'autre, utilisable seulement après la remise.
    const code = (await f.agents.seller.get(`/review-codes/vente/${order.id}`).expect(200)).body;
    expect(code).toMatchObject({ usable: false, review: null });
    expect((await f.agents.seller.get(`/review-codes/vente/${order.id}`).expect(200)).body.code).toBe(code.code);
    const early = await server.post('/reviews').send({ rating: 5, code: code.code }).expect(400);
    expect(early.body.message).toContain('pas encore remise');

    await f.agents.seller.post(`/orders/${order.id}/status`).set(CSRF).send({ status: 'CONFIRMED' }).expect(200);
    await f.agents.seller.post(`/orders/${order.id}/status`).set(CSRF).send({ status: 'COMPLETED' }).expect(200);
    expect((await server.get(`/reviews/check-code?code=${code.code}`).expect(200)).body).toMatchObject({ serviceType: 'ACCESSORY_PURCHASE', subject: 'Achat : Coque avis' });

    await server.post('/reviews').send({ rating: 4, comment: 'Rapide', code: code.code }).expect(201);
    // Publié immédiatement, sans modération, sans donnée personnelle.
    const pub = await server.get('/reviews/public').expect(200);
    expect(pub.body.items[0]).toMatchObject({ verified: true, comment: 'Rapide', serviceType: 'ACCESSORY_PURCHASE' });
    expect(JSON.stringify(pub.body)).not.toContain('90000001');

    // Code à usage unique ; plus de nouveau code une fois l'avis donné.
    await server.post('/reviews').send({ rating: 1, code: code.code }).expect(400);
    await f.agents.seller.post(`/review-codes/vente/${order.id}/regenerate`).set(CSRF).expect(409);

    // La boutique peut masquer un avis abusif.
    const review = await f.prisma.review.findFirstOrThrow({ where: { orderId: order.id } });
    await f.agents.manager.post(`/reviews/${review.id}/moderate`).set(CSRF).send({ status: 'HIDDEN' }).expect(200);
    expect((await server.get('/reviews/public').expect(200)).body.total).toBe(0);
  });

  it('donne un code à chaque vente ; un nouveau code annule l’ancien', async () => {
    const server = request(f.app.getHttpServer());
    const p = await createProduct(f, { name: 'Coque avis', price: 3000, stock: 2, cost: 1000 });
    const sale = await f.agents.seller.post('/orders/counter-sale').set(CSRF).send({ items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'CASH', amount: 3000 }] }).expect(201);
    const first = (await f.agents.seller.get(`/review-codes/vente/${sale.body.id}`).expect(200)).body;
    expect(first.usable).toBe(true);
    const second = (await f.agents.seller.post(`/review-codes/vente/${sale.body.id}/regenerate`).set(CSRF).expect(200)).body;
    expect(second.code).not.toBe(first.code);
    await server.post('/reviews').send({ rating: 5, code: first.code }).expect(400);
    await server.post('/reviews').send({ rating: 5, code: second.code }).expect(201);
    const review = await f.prisma.review.findFirstOrThrow({ where: { orderId: sale.body.id } });
    expect(review).toMatchObject({ serviceType: 'ACCESSORY_PURCHASE', status: 'PUBLISHED' });
    await f.agents.seller.get('/review-codes/autre/x').expect(404);
  });
});

describe('Approvisionnements', () => {
  it('répartit les frais annexes et met à jour le coût moyen à la validation', async () => {
    const p = await createProduct(f, { name: 'Batterie externe', price: 12000, stock: 4, cost: 7000 });
    const supplier = await f.agents.manager.post('/suppliers').set(CSRF).send({ name: 'Grossiste' }).expect(201);
    const purchase = await f.agents.manager
      .post('/purchases')
      .set(CSRF)
      .send({ supplierId: supplier.body.id, purchaseDate: new Date().toISOString(), extraCosts: 4000, items: [{ productId: p.id, quantity: 4, unitCost: 8000 }] })
      .expect(201);
    expect((await product(p.id)).stockQuantity).toBe(4);
    await f.agents.manager.post(`/purchases/${purchase.body.id}/validate`).set(CSRF).expect(200);
    const row = await product(p.id);
    expect(row.stockQuantity).toBe(8);
    // Coût de revient : 8 000 + 4 000/4 = 9 000 ; moyenne (4×7 000 + 4×9 000)/8 = 8 000.
    expect(row.averageCost).toBe(8000);
    await f.agents.manager.post(`/purchases/${purchase.body.id}/validate`).set(CSRF).expect(409);
  });
});

describe('Sécurité et autorisations', () => {
  it('refuse les accès non authentifiés et sans en-tête anti-CSRF', async () => {
    await request(f.app.getHttpServer()).get('/orders').expect(401);
    await f.agents.manager.post('/suppliers').send({ name: 'Sans en-tête' }).expect(403);
  });

  it('vérifie les rôles côté serveur', async () => {
    await f.agents.seller.get('/stats/report').expect(403);
    await f.agents.seller.get('/expenses').expect(403);
    await f.agents.seller.post('/catalog-groups').set(CSRF).send({ kind: 'ACCESSORY', name: 'X', categoryId: f.ids.accCategory, variants: [{ salePrice: 1 }] }).expect(403);
  });

  it('masque les coûts aux vendeurs et au public', async () => {
    const list = await f.agents.seller.get('/products').expect(200);
    expect(list.body.items.every((p: { averageCost: unknown }) => p.averageCost === null)).toBe(true);
    const pub = await request(f.app.getHttpServer()).get('/shop/catalog').expect(200);
    expect(JSON.stringify(pub.body)).not.toMatch(/averageCost|stockValue/);
  });

  it('interdit à un vendeur de modifier un prix au comptoir', async () => {
    const p = await createProduct(f, { name: 'Verre trempé', price: 2500, stock: 5, cost: 700 });
    await f.agents.seller.post('/orders/counter-sale').set(CSRF).send({ items: [{ productId: p.id, quantity: 1, unitPrice: 100 }], payments: [] }).expect(403);
  });
});

describe('Statistiques', () => {
  it('distingue CA et encaissements, exclut annulations et dépenses annulées', async () => {
    // Base de comparaison : on mesure l'effet des opérations de ce test sur « aujourd'hui ».
    const before = (await f.agents.manager.get('/stats/report?period=today').expect(200)).body.totals;

    const p = await createProduct(f, { name: 'Casque', price: 18000, stock: 3, cost: 11000 });
    // Vente au comptoir partiellement payée : CA 18 000, encaissé 10 000.
    await f.agents.seller.post('/orders/counter-sale').set(CSRF).send({ items: [{ productId: p.id, quantity: 1 }], payments: [{ method: 'CASH', amount: 10000 }] }).expect(201);
    // Dépense saisie puis annulée : jamais comptée.
    const expense = await f.agents.manager.post('/expenses').set(CSRF).field('label', 'Loyer').field('category', 'RENT').field('amount', '50000').field('expenseDate', new Date().toISOString().slice(0, 10)).field('paymentMethod', 'CASH').expect(201);
    await f.agents.manager.post('/expenses').set(CSRF).field('label', 'Internet').field('category', 'INTERNET').field('amount', '3000').field('expenseDate', new Date().toISOString().slice(0, 10)).field('paymentMethod', 'CASH').expect(201);
    await f.agents.manager.post(`/expenses/${expense.body.id}/void`).set(CSRF).send({ reason: 'Saisie en double' }).expect(200);

    const after = (await f.agents.manager.get('/stats/report?period=today').expect(200)).body.totals;
    expect(after.revenue - before.revenue).toBe(18000);
    expect(after.cashIn - before.cashIn).toBe(10000);
    expect(after.directCosts - before.directCosts).toBe(11000);
    expect(after.grossMargin - before.grossMargin).toBe(7000);
    expect(after.expenses - before.expenses).toBe(3000);
    expect(after.estimatedResult - before.estimatedResult).toBe(4000);
    expect(after.revenueAccessories - before.revenueAccessories).toBe(18000);
  });
});
