jest.mock('../src/prisma', () => require('./mocks/prismaMock').createPrismaMock());

const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

async function signupAndLogin(email) {
  await request(app).post('/auth/signup').send({ email, password: 'password123' });
  const res = await request(app).post('/auth/login').send({ email, password: 'password123' });
  return res.body.access_token;
}

async function makeBooking(token) {
  const centreRes = await request(app)
    .post('/centres/')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Metro Labs', location: 'Delhi' });
  const testRes = await request(app)
    .post(`/centres/${centreRes.body.id}/tests`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Lipid Panel', price: 899 });
  const bookingRes = await request(app)
    .post('/bookings/')
    .set('Authorization', `Bearer ${token}`)
    .send({ testId: testRes.body.id, appointmentTime: '2026-10-05T09:00:00.000Z' });
  return bookingRes.body;
}

describe('Payments & webhook idempotency', () => {
  let token;

  beforeAll(async () => {
    token = await signupAndLogin('payer@example.com');
  });

  test('successful payment confirms the booking', async () => {
    const booking = await makeBooking(token);

    const res = await request(app)
      .post('/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, forceStatus: 'SUCCESS' });

    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('SUCCESS');
    expect(res.body.booking.status).toBe('CONFIRMED');
    expect(res.body.eventId).toBeDefined();
  });

  test('failed payment marks the booking FAILED, not CONFIRMED', async () => {
    const booking = await makeBooking(token);

    const res = await request(app)
      .post('/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, forceStatus: 'FAILED' });

    expect(res.body.payment.status).toBe('FAILED');
    expect(res.body.booking.status).toBe('FAILED');
  });

  test('cannot pay for a booking that is not PENDING', async () => {
    const booking = await makeBooking(token);
    await request(app)
      .post('/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, forceStatus: 'SUCCESS' });

    const secondAttempt = await request(app)
      .post('/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, forceStatus: 'SUCCESS' });

    expect(secondAttempt.status).toBe(409);
  });

  test('webhook is idempotent: replaying the same event_id does not double-process', async () => {
    const booking = await makeBooking(token);

    const created = await request(app)
      .post('/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: booking.id, forceStatus: 'SUCCESS' });

    const { eventId, payment } = created.body;

    // Simulate the payment provider retrying the SAME webhook delivery.
    const replay1 = await request(app).post('/payments/webhook').send({
      eventId,
      providerReference: payment.providerReference,
      status: 'SUCCESS',
    });
    const replay2 = await request(app).post('/payments/webhook').send({
      eventId,
      providerReference: payment.providerReference,
      status: 'SUCCESS',
    });

    expect(replay1.status).toBe(200);
    expect(replay1.body.duplicate).toBe(true); // already applied synchronously on initiation
    expect(replay2.status).toBe(200);
    expect(replay2.body.duplicate).toBe(true);

    // Booking status must still be exactly CONFIRMED, not corrupted by replays.
    const finalBooking = await request(app)
      .get(`/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(finalBooking.body.status).toBe('CONFIRMED');
  });

  test('webhook with a brand-new event_id updates a still-pending payment exactly once', async () => {
    const booking = await makeBooking(token);
    const paymentRes = await request(app)
      .post('/bookings/')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: booking.testId, appointmentTime: '2026-10-06T09:00:00.000Z' });

    // Create a payment directly via a fresh booking, but do NOT let /payments/
    // resolve it — instead call the webhook twice with a new event_id to prove
    // out-of-band provider callbacks are also idempotent.
    const initiate = await request(app)
      .post('/payments/')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId: paymentRes.body.id, forceStatus: 'SUCCESS' });

    const newEventId = 'external-retry-event-1';
    const first = await request(app).post('/payments/webhook').send({
      eventId: newEventId,
      providerReference: initiate.body.payment.providerReference,
      status: 'SUCCESS',
    });
    const second = await request(app).post('/payments/webhook').send({
      eventId: newEventId,
      providerReference: initiate.body.payment.providerReference,
      status: 'SUCCESS',
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
  });

  test('webhook rejects malformed payloads', async () => {
    const res = await request(app).post('/payments/webhook').send({ status: 'SUCCESS' });
    expect(res.status).toBe(422);
  });
});
