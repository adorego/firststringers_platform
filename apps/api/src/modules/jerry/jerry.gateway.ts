import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectQueue } from '@nestjs/bull'
import type { Queue } from 'bull'
import { SessionService } from './session.service'
import { SendMessageDto } from './dto/send-message.dto'
import { JerryMessage, MessageJob } from '../../shared/types'

@WebSocketGateway({
  cors: {
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

  private connectedAthletes = new Map<string, string>()

  constructor(
    @InjectQueue('jerry') private readonly jerryQueue: Queue,
    private readonly session: SessionService,
  ) {}

  async handleConnection(client: Socket) {
    const athleteId = client.handshake.query.athleteId as string

    if (!athleteId) {
      client.disconnect()
      return
    }

    this.connectedAthletes.set(client.id, athleteId)
    client.join(`athlete:${athleteId}`)

    console.log(`Athlete ${athleteId} connected — socket ${client.id}`)

    client.emit('connected', {
      message: '¡Hola! Soy Jerry, tu agente de representación. ¿Empezamos?',
    })
  }

  handleDisconnect(client: Socket) {
    const athleteId = this.connectedAthletes.get(client.id)
    if (athleteId) {
      this.connectedAthletes.delete(client.id)
      console.log(`Athlete ${athleteId} disconnected`)
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const athleteId = this.connectedAthletes.get(client.id)

    if (!athleteId) {
      client.emit('error', { message: 'No autenticado' })
      return
    }

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
      .emit('error', { message: payload.error })
  }
}