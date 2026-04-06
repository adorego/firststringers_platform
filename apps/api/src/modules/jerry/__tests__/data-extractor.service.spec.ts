import { DataExtractorService } from '../data-extractor.service'

const mockLlm = { extract: jest.fn() }

describe('DataExtractorService', () => {
  let service: DataExtractorService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new DataExtractorService(mockLlm as any)
  })

  describe('guard de intención — retorna null sin llamar al LLM', () => {
    it('retorna null para intent === "question"', async () => {
      const result = await service.extract('¿Cuántos equipos hay en la NCAA?', 'question')
      expect(result).toBeNull()
      expect(mockLlm.extract).not.toHaveBeenCalled()
    })

    it('retorna null para intent === "other"', async () => {
      const result = await service.extract('hola', 'other')
      expect(result).toBeNull()
      expect(mockLlm.extract).not.toHaveBeenCalled()
    })
  })

  describe('delegación al LLM para intents de datos', () => {
    it('delega a llm.extract para intent === "stats"', async () => {
      mockLlm.extract.mockResolvedValue({ performance: { leagueLevel: 'D1' } })
      const result = await service.extract('jugué en la NCAA D1', 'stats')
      expect(mockLlm.extract).toHaveBeenCalledWith('jugué en la NCAA D1', 'stats')
      expect(result).toEqual({ performance: { leagueLevel: 'D1' } })
    })

    it('delega a llm.extract para intent === "academic"', async () => {
      mockLlm.extract.mockResolvedValue({ academic: { gpa: 3.8 } })
      const result = await service.extract('mi GPA es 3.8', 'academic')
      expect(mockLlm.extract).toHaveBeenCalledWith('mi GPA es 3.8', 'academic')
      expect(result).toEqual({ academic: { gpa: 3.8 } })
    })
  })
})
