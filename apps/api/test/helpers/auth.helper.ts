import request from 'supertest';
import { getApp } from './test-app';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export async function registerAthlete(
  name = 'Test Athlete',
  email = `athlete-${Date.now()}@test.com`,
  password = 'Test1234!',
): Promise<AuthTokens & { email: string }> {
  const res = await request(getApp().getHttpServer())
    .post('/auth/register')
    .send({ email, password, name, role: 'ATHLETE' })
    .expect(201);

  return { ...res.body, email };
}

export async function registerRecruiter(
  name = 'Test Recruiter',
  email = `recruiter-${Date.now()}@test.com`,
  password = 'Test1234!',
): Promise<AuthTokens & { email: string }> {
  const res = await request(getApp().getHttpServer())
    .post('/auth/register')
    .send({ email, password, name, role: 'RECRUITER' })
    .expect(201);

  return { ...res.body, email };
}

export async function login(
  email: string,
  password: string,
): Promise<AuthTokens> {
  const res = await request(getApp().getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return res.body;
}

export function decodeJwt(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}
