import { Test, TestingModule } from '@nestjs/testing'
import { SessionService } from '../session.service'
import { RedisService } from '../../../shared/redis/redis.service'
import { PrismaService } from '../../../shared/prisma/prisma.service'
import { JerryMessage, JerrySessionState } from '../../../shared/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
}

const mockPrismaService = {
  jerrySession: {
    create: jest.fn(),
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeSession = (athleteId: string): JerrySessionState => ({
  athleteId,
  messages: [],
  dossierSnapshot: {},
  missingFields: [],
  createdAt: new Date(),
  updatedAt: new Date(),
})

const makeMessage = (role: 'user' | 'assistant', content: string): JerryMessage => ({
  role,
  content,
  timestamp: new Date(),
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SessionService', () => {
  let service: SessionService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile()

    service = module.get<SessionService>(SessionService)
    jest.clearAllMocks()
  })

  // ── getSession ──────────────────────────────────────────────────────────────

  describe('getSession', () => {
    it('debe devolver la sesión existente desde Redis si existe', async () => {
      const athleteId = 'athlete-123'
      const existingSession = makeSession(athleteId)
      mockRedisService.get.mockResolvedValue(JSON.stringify(existingSession))

      const result = await service.getSession(athleteId)

      expect(mockRedisService.get).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
      )
      expect(result.athleteId).toBe(athleteId)
    })

    it('debe crear una sesión nueva si no existe en Redis', async () => {
      const athleteId = 'athlete-nuevo'
      mockRedisService.get.mockResolvedValue(null)
      mockRedisService.setex.mockResolvedValue('OK')

      const result = await service.getSession(athleteId)

      expect(result.athleteId).toBe(athleteId)
      expect(result.messages).toEqual([])
      expect(result.dossierSnapshot).toEqual({})
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
        expect.any(Number),
        expect.any(String),
      )
    })

    it('debe crear sesión nueva si Redis devuelve JSON inválido (datos corruptos)', async () => {
      const athleteId = 'athlete-corrupto'
      mockRedisService.get.mockResolvedValue('esto-no-es-json{{{')
      mockRedisService.setex.mockResolvedValue('OK')

      const result = await service.getSession(athleteId)

      // No crashea — crea sesión limpia en lugar de propagar el SyntaxError
      expect(result.athleteId).toBe(athleteId)
      expect(result.messages).toEqual([])
      // Persistió la sesión nueva en Redis
      expect(mockRedisService.setex).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
        expect.any(Number),
        expect.any(String),
      )
    })

    it('debe usar la key correcta para Redis', async () => {
      const athleteId = 'athlete-456'
      mockRedisService.get.mockResolvedValue(null)
      mockRedisService.setex.mockResolvedValue('OK')

      await service.getSession(athleteId)

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'jerry:session:athlete-456',
      )
    })
  })

  // ── appendMessage ───────────────────────────────────────────────────────────

  describe('appendMessage', () => {
    it('debe agregar un mensaje a la sesión', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      const message = makeMessage('user', 'Hola Jerry')
      await service.appendMessage(athleteId, message)

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.messages).toHaveLength(1)
      expect(savedSession.messages[0].content).toBe('Hola Jerry')
      expect(savedSession.messages[0].role).toBe('user')
    })

    it('debe mantener solo los últimos 20 mensajes en memoria', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)

      // Sesión con 20 mensajes ya existentes
      session.messages = Array.from({ length: 20 }, (_, i) =>
        makeMessage('user', `Mensaje ${i}`),
      )

      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      const newMessage = makeMessage('user', 'Mensaje 21')
      await service.appendMessage(athleteId, newMessage)

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.messages).toHaveLength(20)
      expect(savedSession.messages[19].content).toBe('Mensaje 21')
    })

    it('debe actualizar updatedAt al agregar un mensaje', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      const originalUpdatedAt = session.updatedAt
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.appendMessage(athleteId, makeMessage('user', 'test'))

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(new Date(savedSession.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime(),
      )
    })
  })

  // ── appendMessage (nuevos) ──────────────────────────────────────────────────

  describe('appendMessage — límite de 20 mensajes', () => {
    it('debe mantener exactamente los últimos 20 mensajes y descartar el más antiguo cuando hay 21', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      session.messages = Array.from({ length: 20 }, (_, i) =>
        makeMessage('user', `Mensaje ${i}`),
      )
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.appendMessage(athleteId, makeMessage('user', 'Mensaje 20'))

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.messages).toHaveLength(20)
      expect(savedSession.messages[19].content).toBe('Mensaje 20')
      expect(savedSession.messages[0].content).toBe('Mensaje 1')
    })

    it('debe mantener todos los mensajes si hay menos de 20', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      session.messages = Array.from({ length: 5 }, (_, i) =>
        makeMessage('user', `Mensaje ${i}`),
      )
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.appendMessage(athleteId, makeMessage('user', 'Mensaje 5'))

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.messages).toHaveLength(6)
    })
  })

  // ── updateDossierSnapshot ───────────────────────────────────────────────────

  describe('updateDossierSnapshot', () => {
    it('debe hacer merge de nuevos datos con el snapshot existente', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      session.dossierSnapshot = {
        identity: { sport: 'Football' },
      }
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.updateDossierSnapshot(athleteId, {
        academic: { gpa: 3.8 },
      })

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Football')
      expect(savedSession.dossierSnapshot.academic?.gpa).toBe(3.8)
    })

    it('debe hacer merge profundo sin perder campos existentes dentro de la misma sección', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      session.dossierSnapshot = {
        identity: { sport: 'Football', position: 'QB' },
      }
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.updateDossierSnapshot(athleteId, {
        identity: { sport: 'Soccer' },
      })

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Soccer')
      expect(savedSession.dossierSnapshot.identity?.position).toBe('QB')
    })

    it('debe agregar secciones nuevas sin tocar las existentes', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      session.dossierSnapshot = {
        identity: { sport: 'Football' },
      }
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.updateDossierSnapshot(athleteId, {
        academic: { gpa: 3.8 },
      })

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Football')
      expect(savedSession.dossierSnapshot.academic?.gpa).toBe(3.8)
    })

    it('debe actualizar updatedAt al hacer merge del dossier', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      const originalUpdatedAt = session.updatedAt
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.updateDossierSnapshot(athleteId, { identity: { sport: 'Soccer' } })

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(new Date(savedSession.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime(),
      )
    })

    it('debe sobrescribir datos existentes con los nuevos', async () => {
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      session.dossierSnapshot = {
        identity: { sport: 'Football', position: 'QB' },
      }
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      await service.updateDossierSnapshot(athleteId, {
        identity: { sport: 'Basketball' },
      })

      const savedSession = JSON.parse(
        mockRedisService.setex.mock.calls[0][2],
      ) as JerrySessionState

      expect(savedSession.dossierSnapshot.identity?.sport).toBe('Basketball')
    })
  })

  // ── clearSession ────────────────────────────────────────────────────────────

  describe('clearSession', () => {
    it('debe eliminar la sesión de Redis', async () => {
      const athleteId = 'athlete-123'
      mockRedisService.del.mockResolvedValue(1)

      await service.clearSession(athleteId)

      expect(mockRedisService.del).toHaveBeenCalledWith(
        `jerry:session:${athleteId}`,
      )
    })
  })

  // ── Manejo de fechas (bug conocido) ─────────────────────────────────────────

  describe('fechas tras round-trip por Redis', () => {
    it('el timestamp del mensaje regresa como string después de Redis, no como Date', async () => {
      // Documenta el comportamiento actual — JSON.stringify serializa Date a ISO string,
      // JSON.parse no revierte el string a Date. No se arregla aquí, solo se hace explícito.
      const athleteId = 'athlete-123'
      const session = makeSession(athleteId)
      mockRedisService.get.mockResolvedValue(JSON.stringify(session))
      mockRedisService.setex.mockResolvedValue('OK')

      const originalMessage = makeMessage('user', 'test')
      await service.appendMessage(athleteId, originalMessage)

      // Simular lo que Redis devolvería en la siguiente lectura
      const serialized = mockRedisService.setex.mock.calls[0][2] as string
      mockRedisService.get.mockResolvedValue(serialized)

      const recovered = await service.getSession(athleteId)
      const recoveredMessage = recovered.messages[0]

      // El contenido y rol son correctos
      expect(recoveredMessage).toMatchObject({ role: 'user', content: 'test' })

      // El timestamp ya NO es una instancia de Date después del round-trip
      expect(recoveredMessage.timestamp).not.toBeInstanceOf(Date)
      expect(typeof recoveredMessage.timestamp).toBe('string')
    })
  })

  // ── persistSessionToDb ──────────────────────────────────────────────────────

  describe('persistSessionToDb', () => {
  it('debe guardar la sesión en la base de datos', async () => {
    const athleteId = 'athlete-123'
    const session = makeSession(athleteId)
    session.messages = [
      makeMessage('user', 'Hola'),
      makeMessage('assistant', 'Hola atleta'),
    ]
    mockRedisService.get.mockResolvedValue(JSON.stringify(session))
    mockPrismaService.jerrySession.create.mockResolvedValue({ id: 'session-db-1' })

    await service.persistSessionToDb(athleteId)

    expect(mockPrismaService.jerrySession.create).toHaveBeenCalledWith({
      data: {
        athleteId,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hola' }),
          expect.objectContaining({ role: 'assistant', content: 'Hola atleta' }),
        ]),
        status: 'active',
      },
    })
  })
})


})