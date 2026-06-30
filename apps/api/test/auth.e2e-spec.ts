import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  getHttpServer,
  getPrisma,
} from './helpers/test-app';
import {
  registerAthlete,
  registerRecruiter,
  login,
  decodeJwt,
} from './helpers/auth.helper';
import {
  SendOtpResponse,
  RefreshTokenResponse,
} from './helpers/response-types';

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

      await request(getHttpServer())
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
      await request(getHttpServer())
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

      await request(getHttpServer())
        .post('/auth/login')
        .send({ email: 'a@test.com', password: 'wrong' })
        .expect(401);
    });

    it('rejects nonexistent email with 401', async () => {
      await request(getHttpServer())
        .post('/auth/login')
        .send({ email: 'nope@test.com', password: 'Pass1234!' })
        .expect(401);
    });
  });

  describe('Email verification', () => {
    it('new user starts unverified', async () => {
      await registerAthlete('Verify Test', 'verify@test.com');
      const prisma = getPrisma();

      const user = await prisma.user.findUnique({
        where: { email: 'verify@test.com' },
      });
      expect(user?.emailVerified).toBe(false);
    });

    it('send-otp creates a code and verify-email rejects a wrong one', async () => {
      const auth = await registerAthlete('OTP Test', 'otp@test.com');

      await request(getHttpServer())
        .post('/auth/send-otp')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .expect(201);

      // A code exists in the DB
      const prisma = getPrisma();
      const count = await prisma.verificationCode.count({
        where: { user: { email: 'otp@test.com' } },
      });
      expect(count).toBeGreaterThanOrEqual(1);

      // Wrong code is rejected
      await request(getHttpServer())
        .post('/auth/verify-email')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({ code: '000000' })
        .expect(400);
    });

    it('send-otp is idempotent for already-verified users', async () => {
      const auth = await registerAthlete('Verified', 'done@test.com');
      const prisma = getPrisma();

      // Manually mark as verified
      await prisma.user.update({
        where: { email: 'done@test.com' },
        data: { emailVerified: true },
      });

      const res = await request(getHttpServer())
        .post('/auth/send-otp')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .expect(201);
      const body = res.body as SendOtpResponse;

      expect(body.sent).toBe(true);
    });
  });

  describe('POST /auth/refresh', () => {
    it('refreshes tokens with a valid refresh token', async () => {
      const reg = await registerAthlete();

      const res = await request(getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: reg.refresh_token })
        .expect(201);
      const body = res.body as RefreshTokenResponse;

      expect(body.access_token).toBeDefined();
      expect(body.refresh_token).toBeDefined();
    });

    it('rejects an access token used as refresh token', async () => {
      const reg = await registerAthlete();

      await request(getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: reg.access_token })
        .expect(401);
    });
  });
});
