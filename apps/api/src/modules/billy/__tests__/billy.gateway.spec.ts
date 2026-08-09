import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getQueueToken } from '@nestjs/bull';
import { BillyGateway } from '../billy.gateway';
import { BillySessionService } from '../billy-session.service';
import { BillyConversationService } from '../billy-conversation.service';
import { JerryPitchService } from '../../jerry/jerry-pitch.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { RecruiterService } from '../../recruiter/recruiter.service';
import type { Socket } from 'socket.io';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockQueue = { add: jest.fn() };
const mockSession = {
  getSession: jest.fn(),
  appendMessage: jest.fn(),
  getAndClearPendingSuggestions: jest.fn(),
};
const mockConversations = { findById: jest.fn() };
const mockJwt = { verify: jest.fn() };
const mockJerryPitch = { getPitchForRecruiter: jest.fn() };
const mockDirectConversations = {
  assertRecruiterCanContact: jest.fn(),
  createRequest: jest.fn(),
};
const mockRecruiterService = { findById: jest.fn() };

function makeClient(overrides: {
  token?: string;
  conversationId?: string;
}): Socket & { emitted: Array<[string, unknown]>; disconnected: boolean } {
  const emitted: Array<[string, unknown]> = [];
  const client = {
    id: `socket-${Math.random().toString(36).slice(2, 8)}`,
    handshake: {
      auth: overrides.token !== undefined ? { token: overrides.token } : {},
      query:
        overrides.conversationId !== undefined
          ? { conversationId: overrides.conversationId }
          : {},
    },
    emitted,
    disconnected: false,
    emit(event: string, payload: unknown) {
      emitted.push([event, payload]);
    },
    disconnect() {
      this.disconnected = true;
    },
    join: jest.fn(),
  };
  return client as unknown as Socket & {
    emitted: Array<[string, unknown]>;
    disconnected: boolean;
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BillyGateway — connection auth', () => {
  let gateway: BillyGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillyGateway,
        { provide: getQueueToken('billy'), useValue: mockQueue },
        { provide: BillySessionService, useValue: mockSession },
        { provide: BillyConversationService, useValue: mockConversations },
        { provide: JwtService, useValue: mockJwt },
        { provide: JerryPitchService, useValue: mockJerryPitch },
        { provide: ConversationsService, useValue: mockDirectConversations },
        { provide: RecruiterService, useValue: mockRecruiterService },
        EventEmitter2,
      ],
    }).compile();

    gateway = module.get(BillyGateway);
    gateway.server = {
      sockets: { sockets: new Map() },
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as never;
    jest.clearAllMocks();
  });

  it('rejects a connection without a token', async () => {
    const client = makeClient({ conversationId: 'conv-1' });

    await gateway.handleConnection(client);

    expect(client.disconnected).toBe(true);
    expect(client.emitted[0][0]).toBe('error');
    expect((client.emitted[0][1] as { code: string }).code).toBe(
      'UNAUTHENTICATED',
    );
    expect(mockSession.getSession).not.toHaveBeenCalled();
  });

  it('rejects a connection with an invalid token', async () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const client = makeClient({ token: 'bad-token', conversationId: 'conv-1' });

    await gateway.handleConnection(client);

    expect(client.disconnected).toBe(true);
    expect((client.emitted[0][1] as { message: string }).message).toBe(
      'Invalid token',
    );
  });

  it('rejects a valid token that does not belong to a recruiter', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', athleteId: 'ath-1' });
    const client = makeClient({ token: 'athlete-token', conversationId: 'conv-1' });

    await gateway.handleConnection(client);

    expect(client.disconnected).toBe(true);
    expect((client.emitted[0][1] as { message: string }).message).toBe(
      'Not a recruiter',
    );
  });

  it("rejects a conversation that belongs to another recruiter", async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', recruiterId: 'rec-1' });
    mockConversations.findById.mockResolvedValue({
      id: 'conv-1',
      recruiterId: 'rec-OTHER',
    });
    const client = makeClient({ token: 'token', conversationId: 'conv-1' });

    await gateway.handleConnection(client);

    expect(client.disconnected).toBe(true);
    expect((client.emitted[0][1] as { code: string }).code).toBe('FORBIDDEN');
  });

  it('accepts a recruiter connecting to their own conversation', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', recruiterId: 'rec-1' });
    mockConversations.findById.mockResolvedValue({
      id: 'conv-1',
      recruiterId: 'rec-1',
    });
    mockRecruiterService.findById.mockResolvedValue({
      id: 'rec-1',
      name: 'Coach',
      onboardingCompleted: true,
    });
    mockSession.getSession.mockResolvedValue({
      messages: [{ role: 'assistant', content: 'hi', timestamp: new Date() }],
      searchCriteria: {},
      isOnboarding: false,
    });
    const client = makeClient({ token: 'token', conversationId: 'conv-1' });

    await gateway.handleConnection(client);

    expect(client.disconnected).toBe(false);
    expect(client.emitted.map(([event]) => event)).toContain('session_resumed');
  });

  it('uses the identity from the token, not from the client, when queueing messages', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', recruiterId: 'rec-1' });
    mockConversations.findById.mockResolvedValue({
      id: 'conv-1',
      recruiterId: 'rec-1',
    });
    mockRecruiterService.findById.mockResolvedValue({
      id: 'rec-1',
      onboardingCompleted: true,
    });
    mockSession.getSession.mockResolvedValue({
      messages: [{ role: 'assistant', content: 'hi', timestamp: new Date() }],
      searchCriteria: {},
      isOnboarding: false,
    });
    const client = makeClient({ token: 'token', conversationId: 'conv-1' });
    await gateway.handleConnection(client);

    await gateway.handleMessage(client, { content: 'find me a catcher' });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'process.message',
      expect.objectContaining({
        recruiterId: 'rec-1',
        conversationId: 'conv-1',
      }),
      expect.any(Object),
    );
  });

  it('refuses messages from sockets that never authenticated', async () => {
    const client = makeClient({ token: 'token', conversationId: 'conv-1' });

    await gateway.handleMessage(client, { content: 'hello' });

    expect(mockQueue.add).not.toHaveBeenCalled();
    expect((client.emitted[0][1] as { code: string }).code).toBe(
      'UNAUTHENTICATED',
    );
  });
});
