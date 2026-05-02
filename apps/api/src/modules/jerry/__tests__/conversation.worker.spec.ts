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
import type { LLMService } from '../../../shared/llm/llm.service';
import type { EventEmitter2 } from '@nestjs/event-emitter';
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
  Pick<SessionService, 'getSession' | 'appendMessage' | 'updateDossierSnapshot'>
> = {
  getSession: jest.fn(),
  appendMessage: jest.fn(),
  updateDossierSnapshot: jest.fn(),
};

const mockIntentClassifier: jest.Mocked<Pick<IntentClassifierService, 'classify'>> = {
  classify: jest.fn(),
};

const mockDataExtractor: jest.Mocked<Pick<DataExtractorService, 'extract'>> = {
  extract: jest.fn(),
};

const mockValidator: jest.Mocked<Pick<ValidatorService, 'getMissingFields'>> = {
  getMissingFields: jest.fn(),
};

const mockStrategyPlanner: jest.Mocked<Pick<StrategyPlannerService, 'decide'>> = {
  decide: jest.fn(),
};

const mockPromptBuilder: jest.Mocked<Pick<PromptBuilderService, 'build'>> = {
  build: jest.fn(),
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
    mockIntentClassifier.classify.mockResolvedValue('other');
    mockDataExtractor.extract.mockResolvedValue(null);
    mockValidator.getMissingFields.mockResolvedValue(['GPA']);
    mockStrategyPlanner.decide.mockReturnValue({
      type: 'strategic_ask',
      targetField: 'GPA',
    });
    mockPromptBuilder.build.mockReturnValue('generated system prompt');
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

    expect(mockPromptBuilder.build).toHaveBeenCalledWith(strategy);
    expect(mockPromptBuilder.build).toHaveBeenCalledTimes(1);
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

    const gateway = new JerryGateway(
      mockJerryQueue as unknown as Queue,
      mockSessionGateway as unknown as SessionService,
      mockEventEmitterGateway as unknown as EventEmitter2,
    );

    const mockClient = {
      id: 'socket-1',
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
      handshake: { query: { athleteId: 'athlete-123' } },
    };

    // Connect so the gateway registers athleteId → socketId
    await gateway.handleConnection(mockClient as unknown as Socket);
    await gateway.handleMessage(mockClient as unknown as Socket, {
      content: 'Hello Jerry',
      sessionId: 'session-1',
    });

    expect(callOrder).toEqual(['appendMessage', 'queue.add']);
    // Also verifies that the saved message has role "user"
    expect(mockSessionGateway.appendMessage).toHaveBeenCalledWith(
      'athlete-123',
      expect.objectContaining({ role: 'user', content: 'Hello Jerry' }),
    );
  });
});
