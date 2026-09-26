/**
 * A tiny in-memory stand-in for @prisma/client, implementing only the calls
 * this app actually makes. Used solely by the test suite so the route and
 * idempotency logic can be exercised without a live Postgres connection.
 * It is NOT used by the app at runtime (see src/prisma.js).
 */
function createPrismaMock() {
  const db = {
    users: [],
    centres: [],
    tests: [],
    bookings: [],
    payments: [],
    webhookEvents: [],
  };
  let ids = { user: 1, centre: 1, test: 1, booking: 1, payment: 1, webhook: 1 };
  const uuid = () => 'mock-' + Math.random().toString(36).slice(2);

  function conflictError() {
    const e = new Error('Unique constraint failed');
    e.code = 'P2002';
    return e;
  }

  const client = {
    user: {
      findUnique: async ({ where }) =>
        db.users.find((u) => (where.id ? u.id === where.id : u.email === where.email)) || null,
      create: async ({ data }) => {
        const user = { id: ids.user++, createdAt: new Date(), ...data };
        db.users.push(user);
        return user;
      },
    },
    diagnosticCentre: {
      create: async ({ data }) => {
        const centre = { id: ids.centre++, ...data };
        db.centres.push(centre);
        return centre;
      },
      findMany: async () => db.centres.map((c) => ({ ...c, tests: db.tests.filter((t) => t.centreId === c.id) })),
      findUnique: async ({ where, include }) => {
        const centre = db.centres.find((c) => c.id === where.id);
        if (!centre) return null;
        if (include && include.tests) {
          return { ...centre, tests: db.tests.filter((t) => t.centreId === centre.id) };
        }
        return centre;
      },
    },
    diagnosticTest: {
      create: async ({ data }) => {
        const test = { id: ids.test++, ...data };
        db.tests.push(test);
        return test;
      },
      findMany: async ({ where }) => db.tests.filter((t) => t.centreId === where.centreId),
      findUnique: async ({ where }) => db.tests.find((t) => t.id === where.id) || null,
    },
    booking: {
      create: async ({ data }) => {
        const booking = { id: ids.booking++, createdAt: new Date(), updatedAt: new Date(), ...data };
        db.bookings.push(booking);
        return booking;
      },
      findMany: async ({ where }) => db.bookings.filter((b) => b.userId === where.userId),
      findUnique: async ({ where }) => db.bookings.find((b) => b.id === where.id) || null,
      update: async ({ where, data }) => {
        const booking = db.bookings.find((b) => b.id === where.id);
        Object.assign(booking, data, { updatedAt: new Date() });
        return booking;
      },
    },
    payment: {
      create: async ({ data }) => {
        const payment = {
          id: ids.payment++,
          providerReference: uuid(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        db.payments.push(payment);
        return payment;
      },
      findUnique: async ({ where }) =>
        db.payments.find((p) =>
          where.id ? p.id === where.id : p.providerReference === where.providerReference
        ) || null,
      update: async ({ where, data }) => {
        const payment = db.payments.find((p) => p.id === where.id);
        Object.assign(payment, data, { updatedAt: new Date() });
        return payment;
      },
    },
    webhookEvent: {
      create: async ({ data }) => {
        if (db.webhookEvents.some((e) => e.eventId === data.eventId)) {
          throw conflictError();
        }
        const event = { id: ids.webhook++, processedAt: new Date(), ...data };
        db.webhookEvents.push(event);
        return event;
      },
    },
    $transaction: async (fn) => fn(client),
    __db: db, // test-only escape hatch for assertions
  };

  return client;
}

module.exports = { createPrismaMock };
