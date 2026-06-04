/* eslint-disable @typescript-eslint/unbound-method */
import { JerryGateway } from '../jerry.gateway';
import { Server, Socket } from 'socket.io';
import { JerrySessionState } from '../../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSocket(
  token?: string,
  socketId = 'socket-abc',
): jest.Mocked<Socket> {
  return {
    id: socketId,
    handshake: {
      auth: token ? { token } : {},
    },
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as jest.Mocked<Socket>;
}

function makeSession(messageCount = 0): JerrySessionState {
  return {
    athleteId: 'athlete-uuid-123',
    messages: Array.from({ length: messageCount }, (_, i) => ({
      role: 'user' as const,
      content: `Mensaje ${i}`,
      timestamp: new Date(),
    })),
    dossierSnapshot: {},
    missingFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockJerryQueue = { add: jest.fn() };
const mockJwtService = { verify: jest.fn() };
const mockPrisma = { user: { findUnique: jest.fn() } };
const mockSession = { getSession: jest.fn(), appendMessage: jest.fn() };
const mockEventEmitter = { emit: jest.fn() };

const mockSocketRoom = { emit: jest.fn() };
const mockServer = { to: jest.fn().mockReturnValue(mockSocketRoom) };

const VALID_TOKEN = 'valid-jwt-token';

function makeGateway(): JerryGateway {
  const gateway = new JerryGateway(
    mockJerryQueue as any,
    mockJwtService as any,
    mockPrisma as any,
    mockSession as any,
    mockEventEmitter as any,
  );
  gateway.server = mockServer as unknown as Server;
  return gateway;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JerryGateway', () => {
  let gateway: JerryGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer.to.mockReturnValue(mockSocketRoom);
    mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-456', athleteId: 'athlete-uuid-123' });
    mockSession.getSession.mockResolvedValue(makeSession(0));
    mockSession.appendMessage.mockResolvedValue(undefined);
    mockJerryQueue.add.mockResolvedValue(undefined);
    gateway = makeGateway();
  });

  // ── GRUPO 1 — handleConnection ───────────────────────────────────────────

  describe('handleConnection', () => {
    it('debe verificar JWT y unirse al room correcto', async () => {
      const client = makeSocket(VALID_TOKEN);

      await gateway.handleConnection(client);

      expect(mockJwtService.verify).toHaveBeenCalledWith(VALID_TOKEN);
      expect(client.join).toHaveBeenCalledWith('athlete:athlete-uuid-123');
    });

    it('debe desconectar si no hay token en handshake.auth', async () => {
      const client = makeSocket(undefined);

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      );
      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('debe desconectar si el JWT es inválido', async () => {
      const client = makeSocket('invalid-token');
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'UNAUTHENTICATED', message: 'Invalid token' }),
      );
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('debe desconectar si el JWT no tiene athleteId', async () => {
      const client = makeSocket(VALID_TOKEN);
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid-456' }); // no athleteId

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'UNAUTHENTICATED', message: 'Not an athlete' }),
      );
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('debe emitir session_resumed con mensajes si la sesión tiene historial', async () => {
      const client = makeSocket(VALID_TOKEN);
      const session = makeSession(5);
      mockSession.getSession.mockResolvedValue(session);

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(
        'session_resumed',
        expect.objectContaining({ messages: session.messages }),
      );
      const emittedEvents = (client.emit as jest.Mock).mock.calls.map(
        ([event]: [string, ...unknown[]]) => event,
      );
      expect(emittedEvents).not.toContain('connected');
    });

    it('debe emitir CONNECTION_ERROR y desconectar si getSession lanza', async () => {
      const client = makeSocket(VALID_TOKEN);
      mockSession.getSession.mockRejectedValue(new Error('Redis caído'));

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'CONNECTION_ERROR' }),
      );
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('debe emitir connected con mensaje de Jerry si es sesión nueva (0 mensajes)', async () => {
      const client = makeSocket(VALID_TOKEN);
      mockSession.getSession.mockResolvedValue(makeSession(0));

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(
        'connected',
        expect.objectContaining({
          message: expect.stringContaining('Jerry') as unknown,
        }),
      );
      const emittedEvents = (client.emit as jest.Mock).mock.calls.map(
        ([event]: [string, ...unknown[]]) => event,
      );
      expect(emittedEvents).not.toContain('session_resumed');
    });
  });

  // ── GRUPO 2 — handleMessage ───────────────────────────────────────────────

  describe('handleMessage', () => {
    it('debe encolar el job en Bull con los datos correctos', async () => {
      const client = makeSocket(VALID_TOKEN);
      await gateway.handleConnection(client);
      jest.clearAllMocks();

      await gateway.handleMessage(client, {
        content: 'Hola',
        sessionId: 'sess-1',
      });

      expect(mockJerryQueue.add).toHaveBeenCalledWith(
        'process.message',
        { athleteId: 'athlete-uuid-123', message: 'Hola', sessionId: 'sess-1' },
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('debe emitir status typing ANTES de encolar el job', async () => {
      const client = makeSocket(VALID_TOKEN);
      await gateway.handleConnection(client);
      jest.clearAllMocks();

      const callOrder: string[] = [];
      (client.emit as jest.Mock).mockImplementation((event: string) => {
        callOrder.push(`emit:${event}`);
      });
      mockJerryQueue.add.mockImplementation(() => {
        callOrder.push('queue.add');
        return Promise.resolve();
      });

      await gateway.handleMessage(client, {
        content: 'Hola',
        sessionId: 'sess-1',
      });

      expect(callOrder.indexOf('emit:status')).toBeLessThan(
        callOrder.indexOf('queue.add'),
      );
    });

    it('debe emitir MESSAGE_ERROR si queue.add lanza', async () => {
      const client = makeSocket(VALID_TOKEN);
      await gateway.handleConnection(client);
      jest.clearAllMocks();

      mockJerryQueue.add.mockRejectedValue(new Error('Bull caído'));

      await gateway.handleMessage(client, {
        content: 'Hola',
        sessionId: 'sess-1',
      });

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'MESSAGE_ERROR' }),
      );
    });

    it('debe emitir error y NO encolar si el socket no está autenticado', async () => {
      const client = makeSocket(VALID_TOKEN); // sin pasar por handleConnection

      await gateway.handleMessage(client, {
        content: 'Hola',
        sessionId: 'sess-1',
      });

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      );
      expect(mockJerryQueue.add).not.toHaveBeenCalled();
    });
  });

  // ── GRUPO 3 — handleDisconnect ────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('debe eliminar al atleta del mapa: mensajes posteriores fallan con UNAUTHENTICATED', async () => {
      const client = makeSocket(VALID_TOKEN);
      await gateway.handleConnection(client);

      gateway.handleDisconnect(client);
      jest.clearAllMocks();

      await gateway.handleMessage(client, {
        content: 'Hola',
        sessionId: 'sess-1',
      });

      expect(client.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ code: 'UNAUTHENTICATED' }),
      );
      expect(mockJerryQueue.add).not.toHaveBeenCalled();
    });

    it('no lanza ni emite nada si el socket que desconecta nunca se conectó', () => {
      const unknownSocket = makeSocket(
        VALID_TOKEN,
        'never-connected-socket',
      );
      expect(() => gateway.handleDisconnect(unknownSocket)).not.toThrow();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('debe emitir athlete.disconnected con el athleteId correcto', async () => {
      const client = makeSocket(VALID_TOKEN);
      await gateway.handleConnection(client);

      gateway.handleDisconnect(client);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'athlete.disconnected',
        {
          athleteId: 'athlete-uuid-123',
        },
      );
    });
  });

  // ── GRUPO 4 — @OnEvent handlers ──────────────────────────────────────────

  describe('@OnEvent handlers', () => {
    it('handleJerryResponse emite el mensaje al room correcto con role assistant', () => {
      gateway.handleJerryResponse({
        athleteId: 'athlete-uuid-123',
        message: 'Hola, soy Jerry',
      });

      expect(mockServer.to).toHaveBeenCalledWith('athlete:athlete-uuid-123');
      expect(mockSocketRoom.emit).toHaveBeenCalledWith(
        'message',
        expect.objectContaining({
          role: 'assistant',
          content: 'Hola, soy Jerry',
        }),
      );
    });

    it('handleJerryError emite el error al room correcto con código PROCESSING_ERROR', () => {
      gateway.handleJerryError({
        athleteId: 'athlete-uuid-123',
        error: 'Algo salió mal',
      });

      expect(mockServer.to).toHaveBeenCalledWith('athlete:athlete-uuid-123');
      expect(mockSocketRoom.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          code: 'PROCESSING_ERROR',
          message: 'Algo salió mal',
        }),
      );
    });

    it('handleDossierUpdated emite dossier_updated al room correcto', () => {
      const payload = {
        athleteId: 'athlete-uuid-123',
        data: { identity: { sport: 'Basketball' } },
        completeness: 0.33,
      };

      gateway.handleDossierUpdated(payload);

      expect(mockServer.to).toHaveBeenCalledWith('athlete:athlete-uuid-123');
      expect(mockSocketRoom.emit).toHaveBeenCalledWith(
        'dossier_updated',
        expect.objectContaining({
          data: { identity: { sport: 'Basketball' } },
          completeness: 0.33,
        }),
      );
    });
  });
});
