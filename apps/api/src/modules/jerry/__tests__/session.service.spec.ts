import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../session.service';
import { RedisService } from '../../../shared/redis/redis.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { JerryMessage, JerrySessionState } from '../../../shared/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

const mockPrismaService = {
  jerrySession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeSession = (athleteId: string): JerrySessionState => ({
  athleteId,
  messages: [],
  dossierSnapshot: {},
  missingFields: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeMessage = (
  role: 'user' | 'assistant',
  content: string,
): JerryMessage => ({
  role,
  content,
  timestamp: new Date(),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    jest.clearAllMocks();
    mockPrismaService.jerrySession.findUnique.mockResolvedValue(null);
  });

  // ── getSession ──────────────────────────────────────────────────────────────

  describe('getSession', () => {
    it('returns the existing session from Redis when it exists', async () => {
      const athleteId = 'athlete-123';
      const existingSession = makeSession(athleteId);
      mockRedisService.get.mockResolvedValue(JSON.stringify(existingSession));

      const result = await service.getSession(athleteId);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
      );
      expect(result.athleteId).toBe(athleteId);
    });

    it('creates a new session when none exists in Redis', async () => {
      const athleteId = 'athlete-new';
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await service.getSession(athleteId);

      expect(result.athleteId).toBe(athleteId);
      expect(result.messages).toEqual([]);
      expect(result.dossierSnapshot).toEqual({});
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
        expect.any(Number),
        expect.any(String),
      );
    });

    it('creates a new session when Redis returns invalid JSON (corrupted data)', async () => {
      const athleteId = 'athlete-corrupted';
      mockRedisService.get.mockResolvedValue('not-valid-json{{{');
      mockRedisService.setex.mockResolvedValue('OK');

      const result = await service.getSession(athleteId);

      // Does not crash — creates a clean session instead of propagating SyntaxError
      expect(result.athleteId).toBe(athleteId);
      expect(result.messages).toEqual([]);
      // Persisted the new session in Redis
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
        expect.any(Number),
        expect.any(String),
      );
    });

    it('uses the correct Redis key', async () => {
      const athleteId = 'athlete-456';
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.setex.mockResolvedValue('OK');

      await service.getSession(athleteId);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'jerry:session:athlete-456',
      );
    });
  });

  // ── appendMessage ───────────────────────────────────────────────────────────

  describe('appendMessage', () => {
    it('appends a message to the session', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      const message = makeMessage('user', 'Hello Jerry');
      await service.appendMessage(athleteId, message);

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.messages).toHaveLength(1);
      expect(savedSession.messages[0].content).toBe('Hello Jerry');
      expect(savedSession.messages[0].role).toBe('user');
    });

    it('keeps only the last 20 messages in memory', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);

      session.messages = Array.from({ length: 20 }, (_, i) =>
        makeMessage('user', `Message ${i}`),
      );

      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      const newMessage = makeMessage('user', 'Message 21');
      await service.appendMessage(athleteId, newMessage);

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.messages).toHaveLength(20);
      expect(savedSession.messages[19].content).toBe('Message 21');
    });

    it('updates updatedAt when a message is appended', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      const originalUpdatedAt = session.updatedAt;
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.appendMessage(athleteId, makeMessage('user', 'test'));

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(new Date(savedSession.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime(),
      );
    });
  });

  // ── appendMessage — 20-message limit ───────────────────────────────────────

  describe('appendMessage — 20-message limit', () => {
    it('keeps exactly the last 20 messages and discards the oldest when there are 21', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      session.messages = Array.from({ length: 20 }, (_, i) =>
        makeMessage('user', `Message ${i}`),
      );
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.appendMessage(athleteId, makeMessage('user', 'Message 20'));

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.messages).toHaveLength(20);
      expect(savedSession.messages[19].content).toBe('Message 20');
      expect(savedSession.messages[0].content).toBe('Message 1');
    });

    it('keeps all messages when there are fewer than 20', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      session.messages = Array.from({ length: 5 }, (_, i) =>
        makeMessage('user', `Message ${i}`),
      );
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.appendMessage(athleteId, makeMessage('user', 'Message 5'));

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.messages).toHaveLength(6);
    });
  });

  // ── updateDossierSnapshot ───────────────────────────────────────────────────

  describe('updateDossierSnapshot', () => {
    it('merges new data into the existing snapshot', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      session.dossierSnapshot = {
        identity: { sport: 'Football' },
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.updateDossierSnapshot(athleteId, {
        academic: { gpa: 3.8 },
      });

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Football');
      expect(savedSession.dossierSnapshot.academic?.gpa).toBe(3.8);
    });

    it('performs a deep merge without losing existing fields within the same section', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      session.dossierSnapshot = {
        identity: { sport: 'Football', position: 'QB' },
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.updateDossierSnapshot(athleteId, {
        identity: { sport: 'Soccer' },
      });

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Soccer');
      expect(savedSession.dossierSnapshot.identity?.position).toBe('QB');
    });

    it('adds new sections without touching existing ones', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      session.dossierSnapshot = {
        identity: { sport: 'Football' },
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.updateDossierSnapshot(athleteId, {
        academic: { gpa: 3.8 },
      });

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Football');
      expect(savedSession.dossierSnapshot.academic?.gpa).toBe(3.8);
    });

    it('updates updatedAt when the dossier snapshot is merged', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      const originalUpdatedAt = session.updatedAt;
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.updateDossierSnapshot(athleteId, {
        identity: { sport: 'Soccer' },
      });

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(new Date(savedSession.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime(),
      );
    });

    it('overwrites existing data with new values', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      session.dossierSnapshot = {
        identity: { sport: 'Football', position: 'QB' },
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      await service.updateDossierSnapshot(athleteId, {
        identity: { sport: 'Basketball' },
      });

      const savedSession = JSON.parse(
        (mockRedisService.setex.mock.calls[0] as [string, number, string])[2],
      ) as JerrySessionState;

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Basketball');
    });
  });

  // ── clearSession ────────────────────────────────────────────────────────────

  describe('clearSession', () => {
    it('removes the session from Redis', async () => {
      const athleteId = 'athlete-123';
      mockRedisService.del.mockResolvedValue(1);

      await service.clearSession(athleteId);

      expect(mockRedisService.del).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
      );
    });
  });

  // ── Date handling after Redis round-trip ────────────────────────────────────

  describe('dates after Redis round-trip', () => {
    it('message timestamp comes back as a string after Redis, not as a Date instance', async () => {
      // Documents current behavior — JSON.stringify serializes Date to ISO string,
      // JSON.parse does not convert the string back to Date.
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockRedisService.setex.mockResolvedValue('OK');

      const originalMessage = makeMessage('user', 'test');
      await service.appendMessage(athleteId, originalMessage);

      // Simulate what Redis would return on the next read
      const serialized = (
        mockRedisService.setex.mock.calls[0] as [string, number, string]
      )[2];
      mockRedisService.get.mockResolvedValue(serialized);

      const recovered = await service.getSession(athleteId);
      const recoveredMessage = recovered.messages[0];

      // Content and role are correct
      expect(recoveredMessage).toMatchObject({ role: 'user', content: 'test' });

      // Timestamp is no longer a Date instance after the round-trip
      expect(recoveredMessage.timestamp).not.toBeInstanceOf(Date);
      expect(typeof recoveredMessage.timestamp).toBe('string');
    });
  });

  // ── persistSessionToDb ──────────────────────────────────────────────────────

  describe('persistSessionToDb', () => {
    it('upserts the full session when the database has no history yet', async () => {
      const athleteId = 'athlete-123';
      const session = makeSession(athleteId);
      session.messages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Hello athlete'),
      ];
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockPrismaService.jerrySession.findUnique.mockResolvedValue(null);

      await service.persistSessionToDb(athleteId);

      const expectedMessages = expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Hello' }),
        expect.objectContaining({
          role: 'assistant',
          content: 'Hello athlete',
        }),
      ]) as unknown as JerryMessage[];
      expect(mockPrismaService.jerrySession.upsert).toHaveBeenCalledWith({
        where: { athleteId },
        update: { messages: expectedMessages, status: 'active' },
        create: { athleteId, messages: expectedMessages, status: 'active' },
      });
    });

    it('appends only unseen messages when the database already has history', async () => {
      const athleteId = 'athlete-123';
      const older = {
        role: 'user' as const,
        content: 'Old message',
        timestamp: new Date('2026-08-01T10:00:00.000Z'),
      };
      const shared = {
        role: 'assistant' as const,
        content: 'Shared message',
        timestamp: new Date('2026-08-01T10:01:00.000Z'),
      };
      const fresh = {
        role: 'user' as const,
        content: 'New message',
        timestamp: new Date('2026-08-01T10:02:00.000Z'),
      };

      const session = makeSession(athleteId);
      // Redis window only holds the tail of the conversation
      session.messages = [shared, fresh];
      mockRedisService.get.mockResolvedValue(JSON.stringify(session));
      mockPrismaService.jerrySession.findUnique.mockResolvedValue({
        messages: JSON.parse(JSON.stringify([older, shared])) as JerryMessage[],
      });

      await service.persistSessionToDb(athleteId);

      const [upsertArgs] = mockPrismaService.jerrySession.upsert.mock
        .calls[0] as [{ update: { messages: JerryMessage[] } }];
      const persisted = upsertArgs.update.messages;

      // Old history preserved, shared message not duplicated, new one appended
      expect(persisted).toHaveLength(3);
      expect(persisted.map((m) => m.content)).toEqual([
        'Old message',
        'Shared message',
        'New message',
      ]);
    });
  });

  // ── restore from DB ─────────────────────────────────────────────────────────

  describe('getSession — restore from database', () => {
    it('restores the conversation from the database when Redis has expired', async () => {
      const athleteId = 'athlete-returning';
      const storedMessages = [
        makeMessage('assistant', 'Welcome!'),
        makeMessage('user', 'Hi Jerry'),
      ];
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.setex.mockResolvedValue('OK');
      mockPrismaService.jerrySession.findUnique.mockResolvedValue({
        messages: JSON.parse(JSON.stringify(storedMessages)) as JerryMessage[],
        createdAt: new Date('2026-08-01T09:00:00.000Z'),
      });

      const result = await service.getSession(athleteId);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toMatchObject({
        role: 'assistant',
        content: 'Welcome!',
      });
      // Rehydrated session is cached back into Redis
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
        expect.any(Number),
        expect.any(String),
      );
    });

    it('creates a fresh session when the database row has no messages', async () => {
      const athleteId = 'athlete-empty-db';
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.setex.mockResolvedValue('OK');
      mockPrismaService.jerrySession.findUnique.mockResolvedValue({
        messages: [],
        createdAt: new Date(),
      });

      const result = await service.getSession(athleteId);

      expect(result.messages).toEqual([]);
    });

    it('creates a fresh session when the database lookup fails', async () => {
      const athleteId = 'athlete-db-down';
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.setex.mockResolvedValue('OK');
      mockPrismaService.jerrySession.findUnique.mockRejectedValue(
        new Error('db unavailable'),
      );

      const result = await service.getSession(athleteId);

      expect(result.athleteId).toBe(athleteId);
      expect(result.messages).toEqual([]);
    });
  });
});
