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
  decodeJwt,
} from './helpers/auth.helper';
import { ConversationResponse } from './helpers/response-types';

beforeAll(async () => {
  await createTestApp();
}, 30000);

afterAll(async () => {
  await closeTestApp();
});

afterEach(async () => {
  await truncateAll();
});

async function verifyRecruiter(recruiterId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.recruiter.update({
    where: { id: recruiterId },
    data: {
      onboardingCompleted: true,
      verificationStatus: 'verified',
      verifiedAt: new Date(),
    },
  });
}

describe('Conversations (e2e)', () => {
  describe('Verification gate', () => {
    it('blocks unverified recruiter from creating a connection request (403)', async () => {
      const athlete = await registerAthlete();
      const recruiter = await registerRecruiter();
      const athleteId = decodeJwt(athlete.access_token).athleteId as string;
      const recruiterId = decodeJwt(recruiter.access_token)
        .recruiterId as string;

      // Mark onboarding done but NOT verified
      await getPrisma().recruiter.update({
        where: { id: recruiterId },
        data: { onboardingCompleted: true },
      });

      await request(getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${recruiter.access_token}`)
        .send({ recruiterId, athleteId })
        .expect(403);
    });

    it('allows verified recruiter to create a connection request', async () => {
      const athlete = await registerAthlete();
      const recruiter = await registerRecruiter();
      const athleteId = decodeJwt(athlete.access_token).athleteId as string;
      const recruiterId = decodeJwt(recruiter.access_token)
        .recruiterId as string;

      await verifyRecruiter(recruiterId);

      const res = await request(getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${recruiter.access_token}`)
        .send({ recruiterId, athleteId })
        .expect(201);
      const body = res.body as ConversationResponse;

      expect(body.status).toBe('pending');
      expect(body.athleteId).toBe(athleteId);
    });
  });

  describe('Accept / Decline', () => {
    it('athlete can accept a pending request', async () => {
      const athlete = await registerAthlete();
      const recruiter = await registerRecruiter();
      const athleteId = decodeJwt(athlete.access_token).athleteId as string;
      const recruiterId = decodeJwt(recruiter.access_token)
        .recruiterId as string;

      await verifyRecruiter(recruiterId);

      // Create request
      const conv = await request(getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${recruiter.access_token}`)
        .send({ recruiterId, athleteId })
        .expect(201);
      const convBody = conv.body as ConversationResponse;

      // Accept
      await request(getHttpServer())
        .patch(`/conversations/${convBody.id}/accept`)
        .set('Authorization', `Bearer ${athlete.access_token}`)
        .expect(200);

      // Verify it's accepted
      const updated = await getPrisma().directConversation.findUnique({
        where: { id: convBody.id },
      });
      expect(updated?.status).toBe('accepted');
    });

    it('athlete can decline a pending request', async () => {
      const athlete = await registerAthlete();
      const recruiter = await registerRecruiter();
      const athleteId = decodeJwt(athlete.access_token).athleteId as string;
      const recruiterId = decodeJwt(recruiter.access_token)
        .recruiterId as string;

      await verifyRecruiter(recruiterId);

      const conv = await request(getHttpServer())
        .post('/conversations')
        .set('Authorization', `Bearer ${recruiter.access_token}`)
        .send({ recruiterId, athleteId })
        .expect(201);
      const convBody = conv.body as ConversationResponse;

      await request(getHttpServer())
        .patch(`/conversations/${convBody.id}/decline`)
        .set('Authorization', `Bearer ${athlete.access_token}`)
        .expect(200);

      const updated = await getPrisma().directConversation.findUnique({
        where: { id: convBody.id },
      });
      expect(updated?.status).toBe('declined');
    });
  });
});
