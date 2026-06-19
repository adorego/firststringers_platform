import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  getApp,
  getPrisma,
} from './helpers/test-app';
import { registerRecruiter, decodeJwt } from './helpers/auth.helper';

beforeAll(async () => {
  await createTestApp();
}, 30000);

afterAll(async () => {
  await closeTestApp();
});

afterEach(async () => {
  await truncateAll();
});

describe('Recruiter Verification (e2e)', () => {
  describe('POST /recruiter/verify', () => {
    it('moves verification to under_review with submitted info', async () => {
      const auth = await registerRecruiter();
      const recruiterId = decodeJwt(auth.access_token)
        .recruiterId as string;

      const res = await request(getApp().getHttpServer())
        .post('/recruiter/verify')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({
          title: 'Head Coach',
          website: 'https://athletics.test.edu',
          linkedIn: 'https://linkedin.com/in/coach',
        })
        .expect(201);

      expect(res.body.verificationStatus).toBe('under_review');

      // Verify in DB
      const recruiter = await getPrisma().recruiter.findUnique({
        where: { id: recruiterId },
      });
      expect(recruiter?.verificationStatus).toBe('under_review');
      expect(recruiter?.verificationTitle).toBe('Head Coach');
      expect(recruiter?.verificationWebsite).toBe(
        'https://athletics.test.edu',
      );
    });
  });

  describe('GET /recruiter/profile', () => {
    it('returns the recruiter profile with verification fields', async () => {
      const auth = await registerRecruiter('Coach Test');

      const res = await request(getApp().getHttpServer())
        .get('/recruiter/profile')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .expect(200);

      expect(res.body.name).toBe('Coach Test');
      expect(res.body.verificationStatus).toBe('pending');
    });
  });

  describe('Full verification flow', () => {
    it('pending → under_review → verified', async () => {
      const auth = await registerRecruiter();
      const recruiterId = decodeJwt(auth.access_token)
        .recruiterId as string;

      // Step 1: submit
      await request(getApp().getHttpServer())
        .post('/recruiter/verify')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({ title: 'Assistant Coach', website: 'https://test.edu' })
        .expect(201);

      // Step 2: admin approves (simulate via DB — admin endpoints need ADMIN role)
      await getPrisma().recruiter.update({
        where: { id: recruiterId },
        data: { verificationStatus: 'verified', verifiedAt: new Date() },
      });

      // Step 3: profile reflects verified status
      const res = await request(getApp().getHttpServer())
        .get('/recruiter/profile')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .expect(200);

      expect(res.body.verificationStatus).toBe('verified');
      expect(res.body.verifiedAt).toBeDefined();
    });
  });
});
