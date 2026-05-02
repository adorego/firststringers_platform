import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { OnEvent } from '@nestjs/event-emitter'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { SessionService } from './session.service'
import { SendMessageDto } from './dto/send-message.dto'
import { JerryMessage, MessageJob } from '../../shared/types'

@WebSocketGateway({
  cors: {
    // istanbul ignore next — valor de entorno no inyectable en tests unitarios
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/jerry',
})
export class JerryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(JerryGateway.name)
  private connectedAthletes = new Map<string, string>()

  constructor(
    @InjectQueue('jerry') private readonly jerryQueue: Queue,
    private readonly session: SessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const athleteId = client.handshake.query.athleteId as string

      if (!athleteId) {
        client.disconnect()
        return
      }

      this.connectedAthletes.set(client.id, athleteId)
      client.join(`athlete:${athleteId}`)

      this.logger.log(`Athlete ${athleteId} connected — socket ${client.id}`)

      const session = await this.session.getSession(athleteId)
      if (session.messages.length > 0) {
        client.emit('session_resumed', { messageCount: session.messages.length })
      } else {
        client.emit('connected', {
          message: '¡Hola! Soy Jerry, tu agente de representación. ¿Empezamos?',
        })
      }
    } catch (err) {
      this.logger.error(`Error during connection for socket ${client.id}`, err)
      client.emit('error', { code: 'CONNECTION_ERROR', message: 'Error al conectar' })
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const athleteId = this.connectedAthletes.get(client.id)
    this.connectedAthletes.delete(client.id)
    if (athleteId) {
      this.logger.log(`Athlete ${athleteId} disconnected`)
      void this.eventEmitter.emit('athlete.disconnected', { athleteId })
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const athleteId = this.connectedAthletes.get(client.id)

    if (!athleteId) {
      client.emit('error', { code: 'UNAUTHENTICATED', message: 'No autenticado' })
      return
    }

    try {
      const userMessage: JerryMessage = {
        role: 'user',
        content: dto.content,
        timestamp: new Date(),
      }
      await this.session.appendMessage(athleteId, userMessage)

      client.emit('status', { status: 'typing' })

      const job: MessageJob = {
        athleteId,
        sessionId: dto.sessionId,
        message: dto.content,
      }

      await this.jerryQueue.add('process.message', job, {
        attempts: 3,
        backoff: 2000,
        removeOnComplete: true,
      })
    } catch (err) {
      this.logger.error(`Error handling message for athlete ${athleteId}`, err)
      client.emit('error', { code: 'MESSAGE_ERROR', message: 'Error al procesar el mensaje' })
    }
  }

  @OnEvent('jerry.response')
  handleJerryResponse(payload: { athleteId: string; message: string }) {
    this.server
      .to(`athlete:${payload.athleteId}`)
      .emit('message', {
        role: 'assistant',
        content: payload.message,
        timestamp: new Date(),
      })
  }

  @OnEvent('jerry.error')
  handleJerryError(payload: { athleteId: string; error: string }) {
    this.server
      .to(`athlete:${payload.athleteId}`)
      .emit('error', { code: 'PROCESSING_ERROR', message: payload.error })
  }
}
