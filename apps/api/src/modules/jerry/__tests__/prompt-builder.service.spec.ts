import { PromptBuilderService } from '../prompt-builder.service'
import { ConversationStrategy } from '../../../shared/types'

describe('PromptBuilderService', () => {
  const service = new PromptBuilderService()

  // El prompt siempre incluye el encabezado y las reglas fijas
  const JERRY_HEADER = 'Eres Jerry'
  const RULES_MARKER = 'Haz solo UNA pregunta'

  describe('estructura base del prompt', () => {
    it('siempre incluye la identidad de Jerry y las reglas', () => {
      const result = service.build({ type: 'welcome' })
      expect(result).toContain(JERRY_HEADER)
      expect(result).toContain(RULES_MARKER)
    })
  })

  describe('estrategia: welcome', () => {
    it('incluye instrucción de presentación y pregunta por deporte/posición', () => {
      const result = service.build({ type: 'welcome' })
      expect(result).toContain('Preséntate brevemente')
      expect(result).toContain('deporte')
    })
  })

  describe('estrategia: confirm_and_probe', () => {
    it('menciona el campo confirmado cuando targetField está presente', () => {
      const strategy: ConversationStrategy = { type: 'confirm_and_probe', targetField: 'GPA' }
      const result = service.build(strategy)
      expect(result).toContain('"GPA"')
      expect(result).toContain('Confirma lo que entendiste')
    })

    it('usa instrucción genérica cuando no hay targetField', () => {
      const strategy: ConversationStrategy = { type: 'confirm_and_probe' }
      const result = service.build(strategy)
      expect(result).toContain('Confirma la información recibida')
      expect(result).not.toContain('undefined')
    })
  })

  describe('estrategia: answer_and_redirect', () => {
    it('menciona el campo pendiente cuando targetField está presente', () => {
      const strategy: ConversationStrategy = { type: 'answer_and_redirect', targetField: 'posición' }
      const result = service.build(strategy)
      expect(result).toContain('"posición"')
      expect(result).toContain('Responde la pregunta')
    })

    it('usa instrucción genérica cuando no hay targetField', () => {
      const strategy: ConversationStrategy = { type: 'answer_and_redirect' }
      const result = service.build(strategy)
      expect(result).toContain('redirige hacia el dossier')
      expect(result).not.toContain('undefined')
    })
  })

  describe('estrategia: clarify', () => {
    it('instruye a pedir clarificación amable', () => {
      const result = service.build({ type: 'clarify' })
      expect(result).toContain('clarificación')
      expect(result).toContain('amable')
    })
  })

  describe('estrategia: strategic_ask', () => {
    it('menciona el campo específico cuando targetField está presente', () => {
      const strategy: ConversationStrategy = { type: 'strategic_ask', targetField: 'deporte' }
      const result = service.build(strategy)
      expect(result).toContain('"deporte"')
      expect(result).toContain('Solo esa información')
    })

    it('usa instrucción genérica cuando no hay targetField', () => {
      const strategy: ConversationStrategy = { type: 'strategic_ask' }
      const result = service.build(strategy)
      expect(result).toContain('siguiente campo pendiente')
      expect(result).not.toContain('undefined')
    })
  })

  describe('estrategia: narrative_focus', () => {
    it('indica que el dossier está completo y pide refinar narrativa', () => {
      const result = service.build({ type: 'narrative_focus' })
      expect(result).toContain('dossier está completo')
      expect(result).toContain('narrativa de reclutamiento')
    })
  })

  describe('estrategia: reset', () => {
    it('instruye a retomar la conversación desde el punto relevante', () => {
      const result = service.build({ type: 'reset' })
      expect(result).toContain('Retoma la conversación')
    })
  })
})
