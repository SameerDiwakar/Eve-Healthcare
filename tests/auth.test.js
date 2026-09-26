jest.mock('../src/prisma', () => require('./mocks/prismaMock').createPrismaMock());

const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

describe('Auth', () => {
  test('signup creates a user and rejects duplicate email', async () => {
    const res1 = await request(app)
      .post('/auth/signup')
      .send({ email: 'a@example.com', password: 'password123' });
    expect(res1.status).toBe(201);
    expect(res1.body.email).toBe('a@example.com');
    expect(res1.body.hashedPassword).toBeUndefined();

    const res2 = await request(app)
      .post('/auth/signup')
      .send({ email: 'a@example.com', password: 'password123' });
    expect(res2.status).toBe(400);
  });

  test('signup rejects invalid email / short password', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(422);
  });

  test('login succeeds with correct credentials and fails with wrong password', async () => {
    await request(app).post('/auth/signup').send({ email: 'b@example.com', password: 'password123' });

    const good = await request(app)
      .post('/auth/login')
      .send({ email: 'b@example.com', password: 'password123' });
    expect(good.status).toBe(200);
    expect(good.body.access_token).toBeDefined();

    const bad = await request(app)
      .post('/auth/login')
      .send({ email: 'b@example.com', password: 'wrongpass' });
    expect(bad.status).toBe(401);
  });

  test('protected route rejects missing/invalid token', async () => {
    const noToken = await request(app).get('/bookings/');
    expect(noToken.status).toBe(401);

    const badToken = await request(app).get('/bookings/').set('Authorization', 'Bearer garbage');
    expect(badToken.status).toBe(401);
  });
});
