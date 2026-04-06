import { StrategyPlannerService } from '../strategy-planner.service'
import { JerryMessage, JerrySessionState, StrategyContext } from '../../../shared/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMessage(role: 'user' | 'assistant', content: string): JerryMessage {
  return { role, content, timestamp: new Date() }
}

function makeSession(messages: JerryMessage[] = []): JerrySessionState {
  return {
    athleteId: 'athlete-test',
    messages,
    dossierSnapshot: {},
    missingFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeCtx(overrides: Partial<StrategyContext> = {}): StrategyContext {
  return {
    intent: 'other',
    missingFields: ['GPA'],
    extractedData: null,
    session: makeSession([makeMessage('user', 'Hola'), makeMessage('assistant', 'Bienvenido')]),
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('StrategyPlannerService', () => {
  let service: StrategyPlannerService

  beforeEach(() => {
    service = new StrategyPlannerService()
  })

  // ── Escenarios de primera sesión ─────────────────────────────────────────

  describe('welcome', () => {
    it('retorna "welcome" cuando messages.length === 0 (sesión vacía)', () => {
      const result = service.decide(makeCtx({ session: makeSession([]) }))
      expect(result.type).toBe('welcome')
    })

    it('retorna "welcome" cuando messages.length === 1 (solo el primer mensaje del atleta)', () => {
      const result = service.decide(
        makeCtx({ session: makeSession([makeMessage('user', 'Hola')]) }),
      )
      expect(result.type).toBe('welcome')
    })

    it('NO retorna "welcome" cuando messages.length === 2 (Jerry ya respondió una vez)', () => {
      const result = service.decide(
        makeCtx({
          session: makeSession([
            makeMessage('user', 'Hola'),
            makeMessage('assistant', 'Bienvenido, soy Jerry'),
          ]),
        }),
      )
      expect(result.type).not.toBe('welcome')
    })
  })

  // ── Escenarios de frustración (detectFrustration) ────────────────────────

  describe('reset por frustración', () => {
    it('retorna "reset" cuando el atleta dice "no sé" en los últimos 4 mensajes', () => {
      const session = makeSession([
        makeMessage('user', 'Hola'),
        makeMessage('assistant', '¿Cuál es tu deporte?'),
        makeMessage('user', 'no sé qué responder la verdad'),
      ])
      const result = service.decide(makeCtx({ session }))
      expect(result.type).toBe('reset')
    })

    it('retorna "reset" cuando el atleta dice "para"', () => {
      const session = makeSession([
        makeMessage('user', 'Hola'),
        makeMessage('assistant', '¿Cuál es tu GPA?'),
        makeMessage('user', 'para'),
      ])
      const result = service.decide(makeCtx({ session }))
      expect(result.type).toBe('reset')
    })

    it('NO retorna "reset" cuando "para" fue dicho hace 6 mensajes (fuera de ventana de 4)', () => {
      const session = makeSession([
        makeMessage('user', 'para'),            // índice 0 — fuera de ventana
        makeMessage('assistant', 'Entiendo...'),
        makeMessage('user', 'bueno, sigo'),
        makeMessage('assistant', '¿Tu deporte?'),
        makeMessage('user', 'fútbol americano'),
        makeMessage('assistant', '¿Tu posición?'),
      ])
      const result = service.decide(makeCtx({ session, missingFields: ['GPA'] }))
      expect(result.type).not.toBe('reset')
    })
  })

  // ── Escenarios de campo siguiente (pickNextField) ─────────────────────────

  describe('pickNextField', () => {
    it('pregunta "deporte" antes que "GPA" porque tiene mayor prioridad', () => {
      const result = service.decide(
        makeCtx({ missingFields: ['GPA', 'deporte'], intent: 'other' }),
      )
      expect(result.type).toBe('strategic_ask')
      expect(result.targetField).toBe('deporte')
    })

    it('no repite el campo que Jerry preguntó en su último mensaje', () => {
      const session = makeSession([
        makeMessage('user', 'Hola'),
        makeMessage('assistant', 'Cuéntame tu posición en el campo'),
      ])
      const result = service.decide(
        makeCtx({ session, missingFields: ['posición', 'GPA'], intent: 'other' }),
      )
      expect(result.targetField).not.toBe('posición')
      expect(result.targetField).toBe('GPA')
    })

    it('retorna "narrative_focus" cuando todos los campos están completos', () => {
      const result = service.decide(makeCtx({ missingFields: [] }))
      expect(result.type).toBe('narrative_focus')
    })
  })

  // ── Escenarios de intención ───────────────────────────────────────────────

  describe('intent', () => {
    it('retorna "answer_and_redirect" cuando intent === "question"', () => {
      const result = service.decide(makeCtx({ intent: 'question' }))
      expect(result.type).toBe('answer_and_redirect')
    })

    it('retorna "confirm_and_probe" cuando intent === "stats" y hay datos extraídos', () => {
      const result = service.decide(
        makeCtx({
          intent: 'stats',
          extractedData: { performance: { leagueLevel: 'NCAA D1' } },
        }),
      )
      expect(result.type).toBe('confirm_and_probe')
    })

    it('retorna "strategic_ask" cuando intent === "other" y no hay datos extraídos', () => {
      const result = service.decide(makeCtx({ intent: 'other', extractedData: null }))
      expect(result.type).toBe('strategic_ask')
    })

    it('retorna "clarify" cuando intent === "personal" pero extractedData es null (dato vago)', () => {
      const result = service.decide(
        makeCtx({ intent: 'personal', extractedData: null }),
      )
      expect(result.type).toBe('clarify')
    })
  })

  // ── Escenarios borde ──────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('retorna "narrative_focus" cuando missingFields está vacío aunque intent === "question"', () => {
      const result = service.decide(makeCtx({ missingFields: [], intent: 'question' }))
      expect(result.type).toBe('narrative_focus')
    })

    it('retorna "narrative_focus" cuando missingFields está vacío aunque hay extractedData', () => {
      const result = service.decide(
        makeCtx({
          missingFields: [],
          extractedData: { identity: { sport: 'fútbol' } },
        }),
      )
      expect(result.type).toBe('narrative_focus')
    })
  })
})
