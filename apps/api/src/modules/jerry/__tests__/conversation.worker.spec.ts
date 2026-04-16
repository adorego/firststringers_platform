import type { Job } from 'bull'
import { ConversationWorker } from '../conversation.worker'
import { JerryGateway } from '../jerry.gateway'
import { MessageJob, JerrySessionState, ConversationStrategy } from '../../../shared/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeJob(data: Partial<MessageJob> = {}): Job<MessageJob> {
  return {
    data: { athleteId: 'athlete-123', sessionId: 'session-1', message: 'Hola', ...data },
  } as Job<MessageJob>
}

function makeSession(overrides: Partial<JerrySessionState> = {}): JerrySessionState {
  return {
    athleteId: 'athlete-123',
    messages: [],
    dossierSnapshot: {},
    missingFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ─── Mocks compartidos ───────────────────────────────────────────────────────

const mockSession = {
  getSession: jest.fn(),
  appendMessage: jest.fn(),
  updateDossierSnapshot: jest.fn(),
}
const mockIntentClassifier = { classify: jest.fn() }
const mockDataExtractor = { extract: jest.fn() }
const mockValidator = { getMissingFields: jest.fn() }
const mockStrategyPlanner = { decide: jest.fn() }
const mockPromptBuilder = { build: jest.fn() }
const mockLlm = { chat: jest.fn() }
const mockEventEmitter = { emit: jest.fn() }

function makeWorker(): ConversationWorker {
  return new ConversationWorker(
    mockSession as any,
    mockIntentClassifier as any,
    mockDataExtractor as any,
    mockValidator as any,
    mockStrategyPlanner as any,
    mockPromptBuilder as any,
    mockLlm as any,
    mockEventEmitter as any,
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ConversationWorker', () => {
  let worker: ConversationWorker

  beforeEach(() => {
    jest.clearAllMocks()

    // Defaults que permiten que el pipeline complete sin errores
    mockSession.getSession.mockResolvedValue(makeSession())
    mockSession.appendMessage.mockResolvedValue(undefined)
    mockSession.updateDossierSnapshot.mockResolvedValue(undefined)
    mockIntentClassifier.classify.mockResolvedValue('other')
    mockDataExtractor.extract.mockResolvedValue(null)
    mockValidator.getMissingFields.mockResolvedValue(['GPA'])
    mockStrategyPlanner.decide.mockReturnValue({ type: 'strategic_ask', targetField: 'GPA' })
    mockPromptBuilder.build.mockReturnValue('system prompt generado')
    mockLlm.chat.mockResolvedValue('Respuesta de Jerry')

    worker = makeWorker()
  })

  // ── TEST 1 ───────────────────────────────────────────────────────────────

  it('debe ejecutar el pipeline en el orden correcto', async () => {
    const callOrder: string[] = []

    mockSession.getSession.mockImplementation(async () => {
      callOrder.push('getSession')
      return makeSession()
    })
    mockIntentClassifier.classify.mockImplementation(async () => {
      callOrder.push('classify')
      return 'other'
    })
    mockDataExtractor.extract.mockImplementation(async () => {
      callOrder.push('extract')
      return null
    })
    mockValidator.getMissingFields.mockImplementation(async () => {
      callOrder.push('getMissingFields')
      return ['GPA']
    })
    mockStrategyPlanner.decide.mockImplementation(() => {
      callOrder.push('decide')
      return { type: 'strategic_ask', targetField: 'GPA' }
    })
    mockPromptBuilder.build.mockImplementation(() => {
      callOrder.push('build')
      return 'system prompt'
    })
    mockLlm.chat.mockImplementation(async () => {
      callOrder.push('chat')
      return 'Respuesta'
    })
    mockSession.appendMessage.mockImplementation(async () => {
      callOrder.push('appendMessage')
    })

    await worker.handle(makeJob())

    expect(callOrder).toEqual([
      'getSession',
      'classify',
      'extract',
      'getMissingFields',
      'decide',
      'build',
      'chat',
      'appendMessage',
    ])
  })

  // ── TEST 2 ───────────────────────────────────────────────────────────────

  it('debe emitir dossier.update cuando hay datos extraídos', async () => {
    const extractedData = { academic: { gpa: 3.8 } }
    mockDataExtractor.extract.mockResolvedValue(extractedData)

    await worker.handle(makeJob())

    expect(mockEventEmitter.emit).toHaveBeenCalledWith('dossier.update', {
      athleteId: 'athlete-123',
      newData: extractedData,
    })
  })

  // ── TEST 3 ───────────────────────────────────────────────────────────────

  it('NO debe emitir dossier.update si extract devuelve null, pero sí emite jerry.response', async () => {
    mockDataExtractor.extract.mockResolvedValue(null)

    await worker.handle(makeJob())

    const emittedEvents = mockEventEmitter.emit.mock.calls.map(([event]) => event)
    expect(emittedEvents).not.toContain('dossier.update')
    expect(emittedEvents).toContain('jerry.response')
  })

  // ── TEST 4 ───────────────────────────────────────────────────────────────

  it('debe emitir jerry.error y relanzar el error si falla getSession', async () => {
    const redisError = new Error('Redis caído')
    mockSession.getSession.mockRejectedValue(redisError)

    await expect(worker.handle(makeJob())).rejects.toThrow('Redis caído')

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      'jerry.error',
      expect.objectContaining({ athleteId: 'athlete-123' }),
    )
  })

  // ── TEST 5 ───────────────────────────────────────────────────────────────

  it('promptBuilder.build recibe exactamente el objeto retornado por strategyPlanner.decide', async () => {
    const strategy: ConversationStrategy = { type: 'confirm_and_probe', targetField: 'GPA' }
    mockStrategyPlanner.decide.mockReturnValue(strategy)

    await worker.handle(makeJob())

    expect(mockPromptBuilder.build).toHaveBeenCalledWith(strategy)
    expect(mockPromptBuilder.build).toHaveBeenCalledTimes(1)
  })

  // ── TEST 6 — branch: extractedData vacío ────────────────────────────────

  it('NO debe emitir dossier.update si extract devuelve objeto vacío {}', async () => {
    // Cubre el branch: extractedData es truthy pero Object.keys().length === 0
    mockDataExtractor.extract.mockResolvedValue({})

    await worker.handle(makeJob())

    const emittedEvents = mockEventEmitter.emit.mock.calls.map(([event]) => event)
    expect(emittedEvents).not.toContain('dossier.update')
    expect(mockSession.updateDossierSnapshot).not.toHaveBeenCalled()
    expect(emittedEvents).toContain('jerry.response')
  })
})

// ─── TEST 6 — Gateway ────────────────────────────────────────────────────────

describe('JerryGateway — appendMessage precede al encolado', () => {
  it('guarda el mensaje del atleta en sesión antes de encolar el job', async () => {
    const callOrder: string[] = []

    const mockJerryQueue = {
      add: jest.fn().mockImplementation(async () => {
        callOrder.push('queue.add')
      }),
    }
    const mockSessionGateway = {
      getSession: jest.fn().mockResolvedValue({ messages: [] }),
      appendMessage: jest.fn().mockImplementation(async () => {
        callOrder.push('appendMessage')
      }),
    }

    const mockEventEmitterGateway = { emit: jest.fn() }
    const gateway = new JerryGateway(
      mockJerryQueue as any,
      mockSessionGateway as any,
      mockEventEmitterGateway as any,
    )

    const mockClient = {
      id: 'socket-1',
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn(),
      handshake: { query: { athleteId: 'athlete-123' } },
    }

    // Conectar para que el gateway registre athleteId → socketId
    await gateway.handleConnection(mockClient as any)
    await gateway.handleMessage(mockClient as any, {
      content: 'Hola Jerry',
      sessionId: 'session-1',
    })

    expect(callOrder).toEqual(['appendMessage', 'queue.add'])
    // Verifica además que el mensaje guardado tiene role "user"
    expect(mockSessionGateway.appendMessage).toHaveBeenCalledWith(
      'athlete-123',
      expect.objectContaining({ role: 'user', content: 'Hola Jerry' }),
    )
  })
})
