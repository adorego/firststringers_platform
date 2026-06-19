import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/prisma/prisma.service';

let app: INestApplication;
let prisma: PrismaService;

export async function createTestApp(): Promise<INestApplication> {
  // Point to the test database
  process.env.DATABASE_URL =
    'postgresql://postgres:1234@localhost:5432/firststringers_test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.OPENAI_API_KEY = 'sk-test-fake-key';
  process.env.REDIS_URL = 'redis://localhost:6379';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  await app.init();

  prisma = app.get(PrismaService);

  return app;
}

export function getApp(): INestApplication {
  return app;
}

export function getPrisma(): PrismaService {
  return prisma;
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
  }
}

export async function truncateAll(): Promise<void> {
  // Order matters — FK dependencies
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "direct_messages",
      "direct_conversations",
      "billy_messages",
      "billy_conversations",
      "JerrySession",
      "Dossier",
      "User",
      "Athlete",
      "Recruiter",
      "Organization"
    CASCADE
  `);
}
