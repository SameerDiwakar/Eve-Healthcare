jest.mock('../src/prisma', () => require('./mocks/prismaMock').createPrismaMock());

const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

async function signupAndLogin(email) {
  await request(app).post('/auth/signup').send({ email, password: 'password123' });
  const res = await request(app).post('/auth/login').send({ email, password: 'password123' });
  return res.body.access_token;
}

describe('Centres, tests & bookings', () => {
  let token, otherToken, testId;

  beforeAll(async () => {
    token = await signupAndLogin('owner@example.com');
    otherToken = await signupAndLogin('intruder@example.com');

    const centreRes = await request(app)
      .post('/centres/')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'City Diagnostics', location: 'Delhi' });

    const testRes = await request(app)
      .post(`/centres/${centreRes.body.id}/tests`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'CBC', price: 499 });
    testId = testRes.body.id;
  });

  test('creates a booking in PENDING status with amount copied from the test price', async () => {
    const res = await request(app)
      .post('/bookings/')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId, appointmentTime: '2026-10-01T10:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.amount).toBe(499);
  });

  test('404 for booking against a nonexistent test', async () => {
    const res = await request(app)
      .post('/bookings/')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId: 999999, appointmentTime: '2026-10-01T10:00:00.000Z' });
    expect(res.status).toBe(404);
  });

  test('a user cannot view or cancel another user\'s booking', async () => {
    const created = await request(app)
      .post('/bookings/')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId, appointmentTime: '2026-10-02T10:00:00.000Z' });

    const viewAttempt = await request(app)
      .get(`/bookings/${created.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(viewAttempt.status).toBe(403);

    const cancelAttempt = await request(app)
      .post(`/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(cancelAttempt.status).toBe(403);
  });

  test('cancelling twice is rejected the second time', async () => {
    const created = await request(app)
      .post('/bookings/')
      .set('Authorization', `Bearer ${token}`)
      .send({ testId, appointmentTime: '2026-10-03T10:00:00.000Z' });

    const first = await request(app)
      .post(`/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('CANCELLED');

    const second = await request(app)
      .post(`/bookings/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(409);
  });

  test('404 for an invalid booking id', async () => {
    const res = await request(app)
      .get('/bookings/999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
