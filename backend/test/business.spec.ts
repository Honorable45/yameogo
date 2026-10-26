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

  it('vend un téléphone d’occasion comme exemplaire unique et en garde la marge', async () => {
    const phone = await f.agents.manager
      .post('/used-phones')
      .set(CSRF)
      .send({ brandId: f.ids.brand, phoneModelId: f.ids.model, modelName: 'iPhone 11', condition: 'IMPORTED', storageGb: 128, color: 'Blanc', grade: 'GOOD', purchasePrice: 100000, salePrice: 150000, acquiredAt: new Date().toISOString(), imei: '356938035643809' })
      .expect(201);
    await f.prisma.usedPhoneImage.create({ data: { usedPhoneId: phone.body.id, url: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a' } });
    await f.agents.manager.post(`/used-phones/${phone.body.id}/status`).set(CSRF).send({ status: 'AVAILABLE' }).expect(200);

    // Doublon d'IMEI refusé.
    await f.agents.manager
      .post('/used-phones')
      .set(CSRF)
      .send({ brandId: f.ids.brand, modelName: 'iPhone 11', grade: 'GOOD', purchasePrice: 1, salePrice: 2, acquiredAt: new Date().toISOString(), imei: '35-693803-564380-9', confirmDuplicate: true })
      .expect(409);

    // L'IMEI et le prix d'achat ne sont jamais publics.
    const pub = await request(f.app.getHttpServer()).get('/shop/phones').expect(200);
    expect(JSON.stringify(pub.body)).not.toMatch(/imei|purchasePrice|356938/i);
    // Catégorie « Venu » exposée et filtrable.
    expect(pub.body[0]).toMatchObject({ condition: 'IMPORTED', conditionLabel: 'Venu' });
    expect((await request(f.app.getHttpServer()).get('/shop/phones?condition=NEW').expect(200)).body).toHaveLength(0);

    const sale = await f.agents.seller.post('/orders/counter-sale').set(CSRF).send({ items: [{ usedPhoneId: phone.body.id, quantity: 1 }], payments: [{ method: 'CASH', amount: 150000 }] }).expect(201);
    expect(sale.body.status).toBe('COMPLETED');
    const again = await f.agents.seller.post('/orders/counter-sale').set(CSRF).send({ items: [{ usedPhoneId: phone.body.id, quantity: 1 }], payments: [] });
    expect(again.status).toBe(409);

    const detail = await f.agents.manager.get(`/used-phones/${phone.body.id}`).expect(200);
    expect(detail.body.status).toBe('SOLD');
    expect(detail.body.sales[0].grossMargin).toBe(50000);
  });
});

describe('Réparations', () => {
  it('calcule coûts et marge, consomme et restitue le stock, conserve l’historique', async () => {
    const part = await createProduct(f, { name: 'Écran iPhone 11', price: 0, stock: 2, cost: 6000, kind: 'PART' });
    const created = await f.agents.technician
      .post('/repairs')
      .set(CSRF)
      .send({ customerName: 'Ama', customerPhone: '90000002', brandName: 'Apple', phoneModelId: f.ids.model, modelName: 'iPhone 11', repairTypeId: f.ids.type, reportedIssue: 'Écran cassé', imei: '356938035643809' })
      .expect(201);
    const id = created.body.id;
    expect(created.body.imeiEncrypted).toBeUndefined();

    await f.agents.technician.post(`/repairs/${id}/quotes`).set(CSRF).send({ amount: 15000, details: 'Remplacement écran' }).expect(201);
    const job = await f.prisma.repairJob.findUniqueOrThrow({ where: { id }, include: { quotes: true } });
    // Décision du client via le suivi public (numéro + code).
    await request(f.app.getHttpServer()).post(`/track/${job.number}/quotes/${job.quotes[0].id}/decision`).send({ code: 'WRONGCODE', accept: true }).expect(404);
    const decided = await request(f.app.getHttpServer()).post(`/track/${job.number}/quotes/${job.quotes[0].id}/decision`).send({ code: job.trackingCode, accept: true }).expect(200);
    expect(decided.body.billedAmount).toBe(15000);

    await f.agents.technician.post(`/repairs/${id}/status`).set(CSRF).send({ status: 'IN_PROGRESS' }).expect(200);
    await f.agents.technician.post(`/repairs/${id}/parts`).set(CSRF).send({ source: 'STOCK', productId: part.id, quantity: 1 }).expect(201);
    expect((await product(part.id)).stockQuantity).toBe(1);

    // Une deuxième pièce ajoutée par erreur puis retirée : remise en stock, plus comptée.
    const withTwo = await f.agents.technician.post(`/repairs/${id}/parts`).set(CSRF).send({ source: 'STOCK', productId: part.id, quantity: 1 }).expect(201);
    expect((await product(part.id)).stockQuantity).toBe(0);
    await f.agents.technician.post(`/repairs/${id}/parts/${withTwo.body.parts[1].id}/return`).set(CSRF).send({ note: 'Erreur de saisie' }).expect(200);
    expect((await product(part.id)).stockQuantity).toBe(1);

    await f.agents.technician.patch(`/repairs/${id}`).set(CSRF).send({ consumablesCost: 500, otherDirectCosts: 500 }).expect(200);

    // Le réparateur ne voit ni le coût des pièces du stock ni la marge.
    const techView = await f.agents.technician.get(`/repairs/${id}`).expect(200);
    expect(techView.body.financials).toBeNull();
    expect(techView.body.parts[0].unitCost).toBeNull();

    await f.agents.technician.post(`/repairs/${id}/status`).set(CSRF).send({ status: 'COMPLETED' }).expect(200);
    const managerView = await f.agents.manager.get(`/repairs/${id}`).expect(200);
    expect(managerView.body.financials).toMatchObject({ billedAmount: 15000, partsCost: 6000, directCosts: 7000, grossMargin: 8000 });
    expect(managerView.body.paymentStatus).toBe('UNPAID');
    expect(managerView.body.history.length).toBeGreaterThan(6);
  });

  it('n’autorise pas l’annulation d’un dossier encaissé sans remboursement', async () => {
    const created = await f.agents.technician.post('/repairs').set(CSRF).send({ customerPhone: '90000003', brandName: 'Tecno', modelName: 'Spark 10', reportedIssue: 'Ne charge plus', billedAmount: 5000 }).expect(201);
    await f.agents.seller.post(`/repairs/${created.body.id}/payments`).set(CSRF).send({ kind: 'PAYMENT', amount: 2000, method: 'TMONEY', externalReference: 'TX1' }).expect(201);
    await f.agents.technician.post(`/repairs/${created.body.id}/status`).set(CSRF).send({ status: 'CANCELLED', note: 'Refus du client' }).expect(409);
  });

  it('n’invente jamais de tarif : estimation nulle sans tarif configuré', async () => {
    const res = await request(f.app.getHttpServer()).get(`/repair-catalog/estimate?modelId=${f.ids.model}&typeId=${f.ids.type}`).expect(200);
    expect(res.body.estimate).toBeNull();
    await f.agents.manager.put('/repair-pricing/prices').set(CSRF).send({ phoneModelId: f.ids.model, repairTypeId: f.ids.type, partsPrice: 20000, laborPrice: 8000 }).expect(200);
    const priced = await request(f.app.getHttpServer()).get(`/repair-catalog/estimate?modelId=${f.ids.model}&typeId=${f.ids.type}`).expect(200);
    expect(priced.body.estimate.totalPrice).toBe(28000);
  });
});

describe('Avis clients', () => {
  it('exige un code, attend la fin de la réparation et publie aussitôt', async () => {
    const server = request(f.app.getHttpServer());
    const created = await f.agents.technician.post('/repairs').set(CSRF).send({ customerPhone: '90000004', brandName: 'Apple', modelName: 'iPhone 8', reportedIssue: 'Batterie', billedAmount: 10000 }).expect(201);
    const id = created.body.id;

    // Sans code : refusé.
    await server.post('/reviews').send({ rating: 5, comment: 'Super' }).expect(400);

    // Code créé automatiquement, stable d'un affichage à l'autre, utilisable seulement après la réparation.
    const code = (await f.agents.technician.get(`/review-codes/reparation/${id}`).expect(200)).body;
    expect(code).toMatchObject({ usable: false, review: null });
    expect((await f.agents.technician.get(`/review-codes/reparation/${id}`).expect(200)).body.code).toBe(code.code);
    const early = await server.post('/reviews').send({ rating: 5, code: code.code }).expect(400);
    expect(early.body.message).toContain('pas encore terminée');

    await f.agents.technician.post(`/repairs/${id}/status`).set(CSRF).send({ status: 'IN_PROGRESS' }).expect(200);
    await f.agents.technician.post(`/repairs/${id}/status`).set(CSRF).send({ status: 'COMPLETED' }).expect(200);
    expect((await server.get(`/reviews/check-code?code=${code.code}`).expect(200)).body).toMatchObject({ serviceType: 'REPAIR', subject: 'Réparation de votre Apple iPhone 8' });

    await server.post('/reviews').send({ rating: 4, comment: 'Rapide', code: code.code }).expect(201);
    // Publié immédiatement, sans modération, sans donnée personnelle.
    const pub = await server.get('/reviews/public').expect(200);
    expect(pub.body.items[0]).toMatchObject({ verified: true, comment: 'Rapide', serviceType: 'REPAIR' });
    expect(JSON.stringify(pub.body)).not.toContain('90000004');

    // Code à usage unique ; plus de nouveau code une fois l'avis donné.
    await server.post('/reviews').send({ rating: 1, code: code.code }).expect(400);
    await f.agents.technician.post(`/review-codes/reparation/${id}/regenerate`).set(CSRF).expect(409);
    expect((await f.agents.technician.get(`/review-codes/reparation/${id}`).expect(200)).body).toMatchObject({ code: null, review: { rating: 4 } });

    // La boutique peut masquer un avis abusif.
    const review = await f.prisma.review.findFirstOrThrow({ where: { repairJobId: id } });
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
    await server.post('/reviews').send({ rating: 5, ratingRepair: 5, code: second.code }).expect(201);
    const review = await f.prisma.review.findFirstOrThrow({ where: { orderId: sale.body.id } });
    expect(review).toMatchObject({ serviceType: 'ACCESSORY_PURCHASE', status: 'PUBLISHED', ratingRepair: null });
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
    await f.agents.technician.get('/expenses').expect(403);
    await f.agents.seller.post('/products').set(CSRF).send({ name: 'X', categoryId: f.ids.accCategory, salePrice: 1 }).expect(403);
    await f.agents.technician.post('/orders/counter-sale').set(CSRF).send({ items: [], payments: [] }).expect(403);
  });

  it('masque les coûts aux vendeurs et au public', async () => {
    const list = await f.agents.seller.get('/products').expect(200);
    expect(list.body.items.every((p: { averageCost: unknown }) => p.averageCost === null)).toBe(true);
    const pub = await request(f.app.getHttpServer()).get('/shop/products').expect(200);
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
    // Réparation annulée : jamais comptée.
    const cancelled = await f.agents.technician.post('/repairs').set(CSRF).send({ customerPhone: '90000009', brandName: 'Itel', modelName: 'A70', reportedIssue: 'Écran', billedAmount: 9000 }).expect(201);
    await f.agents.technician.post(`/repairs/${cancelled.body.id}/status`).set(CSRF).send({ status: 'CANCELLED', note: 'Annulé par le client' }).expect(200);

    const after = (await f.agents.manager.get('/stats/report?period=today').expect(200)).body.totals;
    expect(after.revenue - before.revenue).toBe(18000);
    expect(after.cashIn - before.cashIn).toBe(10000);
    expect(after.directCosts - before.directCosts).toBe(11000);
    expect(after.grossMargin - before.grossMargin).toBe(7000);
    expect(after.expenses - before.expenses).toBe(3000);
    expect(after.estimatedResult - before.estimatedResult).toBe(4000);
    expect(after.revenueRepairs).toBe(before.revenueRepairs);
  });
});
