import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  truncateAll,
  getHttpServer,
} from './helpers/test-app';
import { registerAthlete } from './helpers/auth.helper';
import { AthleteResponse, DossierResponse } from './helpers/response-types';

beforeAll(async () => {
  await createTestApp();
}, 30000);

afterAll(async () => {
  await closeTestApp();
});

afterEach(async () => {
  await truncateAll();
});

describe('Athlete (e2e)', () => {
  describe('GET /athletes/me', () => {
    it('returns the authenticated athlete profile', async () => {
      const auth = await registerAthlete('Diego Torres');

      const res = await request(getHttpServer())
        .get('/athletes/me')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .expect(200);
      const body = res.body as AthleteResponse;

      expect(body.name).toBe('Diego Torres');
      expect(body.role).toBe('athlete');
    });

    it('rejects unauthenticated requests with 401', async () => {
      await request(getHttpServer()).get('/athletes/me').expect(401);
    });
  });

  describe('PATCH /athletes/me', () => {
    it('updates the athlete name', async () => {
      const auth = await registerAthlete('Old Name');

      const res = await request(getHttpServer())
        .patch('/athletes/me')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({ name: 'New Name' })
        .expect(200);
      const body = res.body as AthleteResponse;

      expect(body.name).toBe('New Name');
    });

    it('rejects empty name with 400', async () => {
      const auth = await registerAthlete();

      await request(getHttpServer())
        .patch('/athletes/me')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('GET /dossier/me', () => {
    it('returns empty dossier for a new athlete', async () => {
      const auth = await registerAthlete();

      const res = await request(getHttpServer())
        .get('/dossier/me')
        .set('Authorization', `Bearer ${auth.access_token}`)
        .expect(200);
      const body = res.body as DossierResponse;

      expect(body.data).toEqual({});
      expect(body.completeness).toBe(0);
    });
  });
});
