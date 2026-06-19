import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  getApp,
} from './helpers/test-app';
import {
  registerAthlete,
  registerRecruiter,
  login,
  decodeJwt,
} from './helpers/auth.helper';

beforeAll(async () => {
  await createTestApp();
}, 30000);

afterAll(async () => {
  await closeTestApp();
});

afterEach(async () => {
  await truncateAll();
});

describe('Auth (e2e)', () => {
  describe('POST /auth/register', () => {
    it('registers an athlete and returns tokens with athleteId', async () => {
      const res = await registerAthlete('Sofia', 'sofia@test.com');

      expect(res.access_token).toBeDefined();
      expect(res.refresh_token).toBeDefined();

      const claims = decodeJwt(res.access_token);
      expect(claims.role).toBe('ATHLETE');
      expect(claims.athleteId).toBeDefined();
      expect(claims.recruiterId).toBeUndefined();
    });

    it('registers a recruiter and returns tokens with recruiterId', async () => {
      const res = await registerRecruiter('Coach', 'coach@test.com');

      const claims = decodeJwt(res.access_token);
      expect(claims.role).toBe('RECRUITER');
      expect(claims.recruiterId).toBeDefined();
      expect(claims.athleteId).toBeUndefined();
    });

    it('rejects duplicate email with 409', async () => {
      await registerAthlete('A', 'dup@test.com');

      await request(getApp().getHttpServer())
        .post('/auth/register')
        .send({
          email: 'dup@test.com',
          password: 'Test1234!',
          name: 'B',
          role: 'ATHLETE',
        })
        .expect(409);
    });

    it('rejects short password with 400', async () => {
      await request(getApp().getHttpServer())
        .post('/auth/register')
        .send({ email: 'x@test.com', password: '123', name: 'X' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with valid credentials', async () => {
      await registerAthlete('A', 'a@test.com', 'Pass1234!');
      const res = await login('a@test.com', 'Pass1234!');

      expect(res.access_token).toBeDefined();
    });

    it('rejects invalid password with 401', async () => {
      await registerAthlete('A', 'a@test.com', 'Pass1234!');

      await request(getApp().getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@test.com', password: 'wrong' })
        .expect(401);
    });

    it('rejects nonexistent email with 401', async () => {
      await request(getApp().getHttpServer())
        .post('/auth/login')
        .send({ email: 'nope@test.com', password: 'Pass1234!' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('refreshes tokens with a valid refresh token', async () => {
      const reg = await registerAthlete();

      const res = await request(getApp().getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: reg.refresh_token })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
    });

    it('rejects an access token used as refresh token', async () => {
      const reg = await registerAthlete();

      await request(getApp().getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: reg.access_token })
        .expect(401);
    });
  });
});
