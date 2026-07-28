import type { Job } from 'bull';
import type { Queue } from 'bull';
import type { Socket } from 'socket.io';
import { ConversationWorker } from '../conversation.worker';
import { JerryGateway } from '../jerry.gateway';
import type { SessionService } from '../session.service';
import type { IntentClassifierService } from '../intent-classifier.service';
import type { DataExtractorService } from '../data-extractor.service';
import type { ValidatorService } from '../validator.service';
import type { StrategyPlannerService } from '../strategy-planner.service';
import type { PromptBuilderService } from '../prompt-builder.service';
import type { RepresentationService } from '../representation.service';
import type { ManualExtractorService } from '../manual-extractor.service';
import type { OwnersManualService } from '../owners-manual.service';
import type { LLMService } from '../../../shared/llm/llm.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  MessageJob,
  JerrySessionState,
  ConversationStrategy,
} from '../../../shared/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeJob(data: Partial<MessageJob> = {}): Job<MessageJob> {
  return {
    data: {
      athleteId: 'athlete-123',
      sessionId: 'session-1',
      message: 'Hello',
      ...data,
    },
  } as Job<MessageJob>;
}

function makeSession(
  overrides: Partial<JerrySessionState> = {},
): JerrySessionState {
  return {
    athleteId: 'athlete-123',
    messages: [],
    dossierSnapshot: {},
    missingFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Shared mocks ────────────────────────────────────────────────────────────

const mockSession: jest.Mocked<
  Pick<
    SessionService,
    'getSession' | 'appendMessage' | 'updateDossierSnapshot' | 'recordUpdate'
  >
> = {
  getSession: jest.fn(),
  appendMessage: jest.fn(),
  updateDossierSnapshot: jest.fn(),
  recordUpdate: jest.fn(),
};

const mockIntentClassifier: jest.Mocked<
  Pick<IntentClassifierService, 'classify'>
> = {
  classify: jest.fn(),
};

const mockDataExtractor: jest.Mocked<Pick<DataExtractorService, 'extract'>> = {
  extract: jest.fn(),
};

const mockValidator: jest.Mocked<Pick<ValidatorService, 'getMissingFields'>> = {
  getMissingFields: jest.fn(),
};

const mockStrategyPlanner: jest.Mocked<Pick<StrategyPlannerService, 'decide'>> =
  {
    decide: jest.fn(),
  };

const mockPromptBuilder: jest.Mocked<
  Pick<PromptBuilderService, 'build' | 'enforceConversationLeadership'>
> = {
  build: jest.fn(),
  enforceConversationLeadership: jest.fn(),
};

const mockRepresentation: jest.Mocked<
  Pick<RepresentationService, 'ensureActivation' | 'markRepresented'>
> = {
  ensureActivation: jest.fn(),
  markRepresented: jest.fn(),
};

const mockManualExtractor: jest.Mocked<
  Pick<ManualExtractorService, 'extract'>
> = {
  extract: jest.fn(),
};

const mockOwnersManual: jest.Mocked<
  Pick<OwnersManualService, 'get' | 'merge'>
> = {
  get: jest.fn(),
  merge: jest.fn(),
};

const mockLlm: jest.Mocked<Pick<LLMService, 'chat'>> = {
  chat: jest.fn(),
};

const mockEventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>> = {
  emit: jest.fn(),
};

function makeWorker(): ConversationWorker {
  return new ConversationWorker(
    mockSession as unknown as SessionService,
    mockIntentClassifier as unknown as IntentClassifierService,
    mockDataExtractor as unknown as DataExtractorService,
    mockValidator as unknown as ValidatorService,
    mockStrategyPlanner as unknown as StrategyPlannerService,
    mockPromptBuilder as unknown as PromptBuilderService,
    mockRepresentation as unknown as RepresentationService,
    mockManualExtractor as unknown as ManualExtractorService,
    mockOwnersManual as unknown as OwnersManualService,
    mockLlm as unknown as LLMService,
    mockEventEmitter as unknown as EventEmitter2,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ConversationWorker', () => {
  let worker: ConversationWorker;

  beforeEach(() => {
    jest.clearAllMocks();

    // Defaults that allow the pipeline to complete without errors
    mockSession.getSession.mockResolvedValue(makeSession());
    mockSession.appendMessage.mockResolvedValue(undefined);
    mockSession.updateDossierSnapshot.mockResolvedValue(undefined);
    mockSession.recordUpdate.mockResolvedValue(undefined);
    mockIntentClassifier.classify.mockResolvedValue('other');
    mockDataExtractor.extract.mockResolvedValue(null);
    mockValidator.getMissingFields.mockResolvedValue(['GPA']);
    mockStrategyPlanner.decide.mockReturnValue({
      type: 'strategic_ask',
      targetField: 'GPA',
    });
    mockPromptBuilder.build.mockReturnValue('generated system prompt');
    mockPromptBuilder.enforceConversationLeadership.mockImplementation(
      (response) => response,
    );
    mockManualExtractor.extract.mockResolvedValue(null);
    mockOwnersManual.get.mockResolvedValue({});
    mockOwnersManual.merge.mockResolvedValue(undefined);
    mockLlm.chat.mockResolvedValue('Jerry response');

    worker = makeWorker();
  });

  // ── TEST 1 ───────────────────────────────────────────────────────────────

  it('runs the pipeline in the correct order', async () => {
    const callOrder: string[] = [];

    mockSession.getSession.mockImplementation(() => {
      callOrder.push('getSession');
      return Promise.resolve(makeSession());
    });
    mockIntentClassifier.classify.mockImplementation(() => {
      callOrder.push('classify');
      return Promise.resolve('other');
    });
    mockDataExtractor.extract.mockImplementation(() => {
      callOrder.push('extract');
      return Promise.resolve(null);
    });
    mockValidator.getMissingFields.mockImplementation(() => {
      callOrder.push('getMissingFields');
      return Promise.resolve(['GPA']);
    });
    mockStrategyPlanner.decide.mockImplementation(() => {
      callOrder.push('decide');
      return { type: 'strategic_ask', targetField: 'GPA' };
    });
    mockPromptBuilder.build.mockImplementation(() => {
      callOrder.push('build');
      return 'system prompt';
    });
    mockLlm.chat.mockImplementation(() => {
      callOrder.push('chat');
      return Promise.resolve('Response');
    });
    mockSession.appendMessage.mockImplementation(() => {
      callOrder.push('appendMessage');
      return Promise.resolve();
    });

    await worker.handle(makeJob());

    expect(callOrder).toEqual([
      'getSession',
      'classify',
      'extract',
      'getMissingFields',
      'decide',
      'build',
      'chat',
      'appendMessage',
    ]);
  });

  // ── TEST 2 ───────────────────────────────────────────────────────────────

  it('emits dossier.update when data is extracted', async () => {
    const extractedData = { academic: { gpa: 3.8 } };
    mockDataExtractor.extract.mockResolvedValue(extractedData);

    await worker.handle(makeJob());

    expect(mockEventEmitter.emit).toHaveBeenCalledWith('dossier.update', {
      athleteId: 'athlete-123',
      newData: extractedData,
    });
  });

  // ── TEST 3 ───────────────────────────────────────────────────────────────

  it('does not emit dossier.update when extract returns null, but does emit jerry.response', async () => {
    mockDataExtractor.extract.mockResolvedValue(null);

    await worker.handle(makeJob());

    const emittedEvents = mockEventEmitter.emit.mock.calls.map(
      ([event]: [string, ...unknown[]]) => event,
    );
    expect(emittedEvents).not.toContain('dossier.update');
    expect(emittedEvents).toContain('jerry.response');
  });

  // ── TEST 4 ───────────────────────────────────────────────────────────────

  it('emits jerry.error and rethrows when getSession fails', async () => {
    const redisError = new Error('Redis down');
    mockSession.getSession.mockRejectedValue(redisError);

    await expect(worker.handle(makeJob())).rejects.toThrow('Redis down');

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'jerry.error',
      expect.objectContaining({ athleteId: 'athlete-123' }),
    );
  });

  // ── TEST 5 ───────────────────────────────────────────────────────────────

  it('passes the exact strategy object from strategyPlanner.decide to promptBuilder.build', async () => {
    const strategy: ConversationStrategy = {
      type: 'confirm_and_probe',
      targetField: 'GPA',
    };
    mockStrategyPlanner.decide.mockReturnValue(strategy);

    await worker.handle(makeJob());

    expect(mockPromptBuilder.build).toHaveBeenCalledWith(strategy, {});
    expect(mockPromptBuilder.build).toHaveBeenCalledTimes(1);
  });

  it('enforces conversation leadership before saving and emitting Jerry response', async () => {
    const strategy: ConversationStrategy = {
      type: 'answer_and_redirect',
      targetField: 'GPA',
    };
    const rawResponse =
      "Knowing this helps me represent you accurately. If there's anything else you'd like to ask, let me know.";
    const controlledResponse =
      'Knowing this helps me represent you accurately. What is your current GPA?';
    mockStrategyPlanner.decide.mockReturnValue(strategy);
    mockLlm.chat.mockResolvedValue(rawResponse);
    mockPromptBuilder.enforceConversationLeadership.mockReturnValue(
      controlledResponse,
    );

    await worker.handle(makeJob({ message: 'Why do you need to know that?' }));

    expect(
      mockPromptBuilder.enforceConversationLeadership,
    ).toHaveBeenCalledWith(rawResponse, strategy);
    expect(mockSession.appendMessage).toHaveBeenCalledWith(
      'athlete-123',
      expect.objectContaining({ content: controlledResponse }),
    );
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('jerry.response', {
      athleteId: 'athlete-123',
      message: controlledResponse,
    });
  });

  // ── TEST 6 — branch: empty extractedData ────────────────────────────────

  it('does not emit dossier.update when extract returns empty object {}', async () => {
    // Covers branch: extractedData is truthy but Object.keys().length === 0
    mockDataExtractor.extract.mockResolvedValue({});

    await worker.handle(makeJob());

    const emittedEvents = mockEventEmitter.emit.mock.calls.map(
      ([event]: [string, ...unknown[]]) => event,
    );
    expect(emittedEvents).not.toContain('dossier.update');
    expect(mockSession.updateDossierSnapshot).not.toHaveBeenCalled();
    expect(emittedEvents).toContain('jerry.response');
  });

  it('marks the athlete represented when the strategy is activation', async () => {
    mockStrategyPlanner.decide.mockReturnValue({ type: 'activation' });

    await worker.handle(makeJob());

    expect(mockRepresentation.markRepresented).toHaveBeenCalledWith(
      'athlete-123',
    );
    expect(mockRepresentation.ensureActivation).not.toHaveBeenCalled();
  });

  it('marks the athlete represented when the strategy is continuous', async () => {
    mockStrategyPlanner.decide.mockReturnValue({ type: 'continuous' });

    await worker.handle(makeJob());

    expect(mockRepresentation.markRepresented).toHaveBeenCalledWith(
      'athlete-123',
    );
  });

  it('moves the athlete into activation during onboarding strategies', async () => {
    mockStrategyPlanner.decide.mockReturnValue({
      type: 'strategic_ask',
      targetField: 'GPA',
    });

    await worker.handle(makeJob());

    expect(mockRepresentation.ensureActivation).toHaveBeenCalledWith(
      'athlete-123',
    );
    expect(mockRepresentation.markRepresented).not.toHaveBeenCalled();
  });

  it("merges manual insights into the Owner's Manual when the extractor finds them", async () => {
    const insights = { motivations: ['prove doubters wrong'] };
    mockManualExtractor.extract.mockResolvedValue(insights);

    await worker.handle(makeJob());

    expect(mockOwnersManual.merge).toHaveBeenCalledWith(
      'athlete-123',
      insights,
    );
  });

  it("does not touch the Owner's Manual when no insights are found", async () => {
    mockManualExtractor.extract.mockResolvedValue(null);

    await worker.handle(makeJob());

    expect(mockOwnersManual.merge).not.toHaveBeenCalled();
  });

  it("feeds the Owner's Manual into the prompt builder", async () => {
    const manual = { communicationStyle: 'direct and brief' };
    mockOwnersManual.get.mockResolvedValue(manual);

    await worker.handle(makeJob());

    expect(mockPromptBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'strategic_ask' }),
      manual,
    );
  });

  describe('initiate — Jerry speaks first', () => {
    function makeInitiateJob(): Job<{ athleteId: string }> {
      return { data: { athleteId: 'athlete-123' } } as Job<{
        athleteId: string;
      }>;
    }

    it('sends the welcome without any athlete message and persists it', async () => {
      mockStrategyPlanner.decide.mockReturnValue({
        type: 'welcome',
        targetField: 'graduation year',
      });
      mockLlm.chat.mockResolvedValue('Hey — I am Jerry.');

      await worker.initiate(makeInitiateJob());

      expect(mockStrategyPlanner.decide).toHaveBeenCalledWith(
        expect.objectContaining({ intent: 'other', extractedData: null }),
      );
      expect(mockPromptBuilder.build).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'welcome' }),
        {},
      );
      expect(mockRepresentation.ensureActivation).toHaveBeenCalledWith(
        'athlete-123',
      );
      expect(mockSession.appendMessage).toHaveBeenCalledWith(
        'athlete-123',
        expect.objectContaining({
          role: 'assistant',
          content: 'Hey — I am Jerry.',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('jerry.response', {
        athleteId: 'athlete-123',
        message: 'Hey — I am Jerry.',
      });
    });

    it('does nothing when the session already has messages', async () => {
      mockSession.getSession.mockResolvedValue(
        makeSession({
          messages: [{ role: 'user', content: 'Hello', timestamp: new Date() }],
        }),
      );

      await worker.initiate(makeInitiateJob());

      expect(mockStrategyPlanner.decide).not.toHaveBeenCalled();
      expect(mockLlm.chat).not.toHaveBeenCalled();
      expect(mockSession.appendMessage).not.toHaveBeenCalled();
    });

    it('greets a returning representable athlete in continuous mode', async () => {
      mockStrategyPlanner.decide.mockReturnValue({ type: 'continuous' });

      await worker.initiate(makeInitiateJob());

      expect(mockRepresentation.markRepresented).toHaveBeenCalledWith(
        'athlete-123',
      );
      expect(mockPromptBuilder.build).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'continuous' }),
        {},
      );
    });

    it('emits jerry.error and rethrows when initiation fails', async () => {
      mockSession.getSession.mockRejectedValue(new Error('Redis down'));

      await expect(worker.initiate(makeInitiateJob())).rejects.toThrow(
        'Redis down',
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'jerry.error',
        expect.objectContaining({ athleteId: 'athlete-123' }),
      );
    });
  });
});

// ─── Gateway ─────────────────────────────────────────────────────────────────

describe('JerryGateway — appendMessage precedes queue enqueue', () => {
  it('saves the athlete message to session before enqueuing the job', async () => {
    const callOrder: string[] = [];

    const mockJerryQueue: jest.Mocked<Pick<Queue, 'add'>> = {
      add: jest.fn().mockImplementation(() => {
        callOrder.push('queue.add');
        return Promise.resolve();
      }),
    };
    const mockSessionGateway: jest.Mocked<
      Pick<SessionService, 'getSession' | 'appendMessage'>
    > = {
      getSession: jest.fn().mockResolvedValue({ messages: [] }),
      appendMessage: jest.fn().mockImplementation(() => {
        callOrder.push('appendMessage');
        return Promise.resolve();
      }),
    };

    const mockEventEmitterGateway: jest.Mocked<Pick<EventEmitter2, 'emit'>> = {
      emit: jest.fn(),
    };

    const mockJwtService = {
      verify: jest
        .fn()
        .mockReturnValue({ sub: 'user-uuid-1', athleteId: 'athlete-123' }),
    };
    const mockPrisma = {};

    const gateway = new JerryGateway(
      mockJerryQueue as unknown as Queue,
      mockJwtService as unknown as JwtService,
      mockPrisma as unknown as PrismaService,
      mockSessionGateway as unknown as SessionService,
      mockEventEmitterGateway as unknown as EventEmitter2,
    );

    const mockClient = {
      id: 'socket-1',
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
      handshake: { auth: { token: 'valid-token' } },
    };

    // Connect so the gateway registers athleteId → socketId
    await gateway.handleConnection(mockClient as unknown as Socket);
    await gateway.handleMessage(mockClient as unknown as Socket, {
      content: 'Hello Jerry',
      sessionId: 'session-1',
    });

    // Empty session on connect → Jerry initiates (first queue.add),
    // then the athlete message is saved before its own enqueue
    expect(callOrder).toEqual(['queue.add', 'appendMessage', 'queue.add']);
    expect(mockJerryQueue.add).toHaveBeenNthCalledWith(
      1,
      'process.initiate',
      { athleteId: 'athlete-123' },
      expect.objectContaining({ jobId: 'initiate:athlete-123' }),
    );
    expect(mockJerryQueue.add).toHaveBeenNthCalledWith(
      2,
      'process.message',
      expect.objectContaining({ athleteId: 'athlete-123' }),
      expect.any(Object),
    );
    // Also verifies that the saved message has role "user"
    expect(mockSessionGateway.appendMessage).toHaveBeenCalledWith(
      'athlete-123',
      expect.objectContaining({ role: 'user', content: 'Hello Jerry' }),
    );
    expect(mockClient.emit).toHaveBeenCalledWith('connected', {
      initiating: true,
    });
  });

  it('does not initiate when the session already has messages', async () => {
    const mockJerryQueue: jest.Mocked<Pick<Queue, 'add'>> = {
      add: jest.fn().mockResolvedValue(undefined as never),
    };
    const mockSessionGateway = {
      getSession: jest.fn().mockResolvedValue({
        messages: [
          { role: 'assistant', content: 'Hey', timestamp: new Date() },
        ],
      }),
      appendMessage: jest.fn(),
    };
    const mockJwtService = {
      verify: jest
        .fn()
        .mockReturnValue({ sub: 'user-uuid-1', athleteId: 'athlete-123' }),
    };

    const gateway = new JerryGateway(
      mockJerryQueue as unknown as Queue,
      mockJwtService as unknown as JwtService,
      {} as unknown as PrismaService,
      mockSessionGateway as unknown as SessionService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    const mockClient = {
      id: 'socket-2',
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
      handshake: { auth: { token: 'valid-token' } },
    };

    await gateway.handleConnection(mockClient as unknown as Socket);

    expect(mockJerryQueue.add).not.toHaveBeenCalled();
    expect(mockClient.emit).toHaveBeenCalledWith(
      'session_resumed',
      expect.objectContaining({ messages: expect.any(Array) as unknown[] }),
    );
  });
});
