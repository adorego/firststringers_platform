import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SessionService } from './session.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JerryMessage, MessageJob, DossierData } from '../../shared/types';

@WebSocketGateway({
  cors: {
    // istanbul ignore next — env value not injectable in unit tests
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/jerry',
})
export class JerryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(JerryGateway.name);
  private connectedAthletes = new Map<string, string>();

  constructor(
    @InjectQueue('jerry') private readonly jerryQueue: Queue,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly session: SessionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mail: MailService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token as string | undefined;

      if (!token) {
        client.emit('error', {
          code: 'UNAUTHENTICATED',
          message: 'Token required',
        });
        client.disconnect();
        return;
      }

      let payload: { sub: string; athleteId?: string };
      try {
        payload = this.jwt.verify<{ sub: string; athleteId?: string }>(token);
      } catch {
        client.emit('error', {
          code: 'UNAUTHENTICATED',
          message: 'Invalid token',
        });
        client.disconnect();
        return;
      }

      if (!payload.athleteId) {
        client.emit('error', {
          code: 'UNAUTHENTICATED',
          message: 'Not an athlete',
        });
        client.disconnect();
        return;
      }

      const athleteId = payload.athleteId;
      this.connectedAthletes.set(client.id, athleteId);
      // Fire-and-forget: socket.io types join() as Promise<void> to support
      // distributed adapters; the in-memory adapter resolves synchronously.
      void client.join(`athlete:${athleteId}`);

      this.logger.log(`Athlete ${athleteId} connected — socket ${client.id}`);

      const session = await this.session.getSession(athleteId);
      if (session.messages.length > 0) {
        client.emit('session_resumed', {
          messages: session.messages,
        });
      } else {
        client.emit('connected', {
          message:
            "Hi! I'm Jerry, your sports representation agent. Ready to get started?",
        });
      }
    } catch (err) {
      this.logger.error(`Error during connection for socket ${client.id}`, err);
      client.emit('error', {
        code: 'CONNECTION_ERROR',
        message: 'Connection error',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const athleteId = this.connectedAthletes.get(client.id);
    this.connectedAthletes.delete(client.id);
    if (athleteId) {
      this.logger.log(`Athlete ${athleteId} disconnected`);
      void this.eventEmitter.emit('athlete.disconnected', { athleteId });
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const athleteId = this.connectedAthletes.get(client.id);

    if (!athleteId) {
      client.emit('error', {
        code: 'UNAUTHENTICATED',
        message: 'Not authenticated',
      });
      return;
    }

    if (!dto?.content || typeof dto.content !== 'string') {
      client.emit('error', {
        code: 'INVALID_PAYLOAD',
        message: 'Message content is required',
      });
      return;
    }

    try {
      const userMessage: JerryMessage = {
        role: 'user',
        content: dto.content,
        timestamp: new Date(),
      };
      await this.session.appendMessage(athleteId, userMessage);

      client.emit('status', { status: 'typing' });

      const job: MessageJob = {
        athleteId,
        sessionId: dto.sessionId,
        message: dto.content,
      };

      await this.jerryQueue.add('process.message', job, {
        attempts: 3,
        backoff: 2000,
        removeOnComplete: true,
      });
    } catch (err) {
      this.logger.error(`Error handling message for athlete ${athleteId}`, err);
      client.emit('error', {
        code: 'MESSAGE_ERROR',
        message: 'Error processing message',
      });
    }
  }

  @OnEvent('jerry.response')
  handleJerryResponse(payload: { athleteId: string; message: string }) {
    this.server.to(`athlete:${payload.athleteId}`).emit('message', {
      role: 'assistant',
      content: payload.message,
      timestamp: new Date(),
    });
  }

  @OnEvent('jerry.error')
  handleJerryError(payload: { athleteId: string; error: string }) {
    this.server
      .to(`athlete:${payload.athleteId}`)
      .emit('error', { code: 'PROCESSING_ERROR', message: payload.error });
  }

  @OnEvent('dossier.updated')
  handleDossierUpdated(payload: {
    athleteId: string;
    data: DossierData;
    completeness: number;
  }) {
    this.server.to(`athlete:${payload.athleteId}`).emit('dossier_updated', {
      data: payload.data,
      completeness: payload.completeness,
    });
  }

  // Billy sent a connection request: Jerry notifies the athlete with accept/decline options
  @OnEvent('contact.initiated')
  async handleContactInitiated(payload: {
    athleteId: string;
    athleteName?: string;
    recruiterName: string;
    organizationName?: string;
    conversationId: string;
    pitch?: string;
  }) {
    try {
      const from = payload.organizationName
        ? `${payload.recruiterName} from ${payload.organizationName}`
        : payload.recruiterName;

      const message: JerryMessage = {
        role: 'assistant',
        content: `Heads up — ${from} wants to connect with you directly. This is your call. Accept if you're interested, or decline and I'll handle it professionally. Either way, I'm in your corner.`,
        timestamp: new Date(),
      };

      await this.session.appendMessage(payload.athleteId, message);

      this.server.to(`athlete:${payload.athleteId}`).emit('message', message);
      this.server
        .to(`athlete:${payload.athleteId}`)
        .emit('connection_request', {
          conversationId: payload.conversationId,
          recruiterName: payload.recruiterName,
          organizationName: payload.organizationName,
          pitch: payload.pitch,
        });

      this.logger.log(
        `Jerry notified athlete ${payload.athleteId} of connection request from ${from}`,
      );

      // Email fallback for athletes who are offline when the request arrives
      const athlete = await this.prisma.athlete.findUnique({
        where: { id: payload.athleteId },
        select: { email: true, name: true },
      });
      if (athlete) {
        void this.mail.sendConnectionRequestEmail({
          to: athlete.email,
          athleteName: payload.athleteName ?? athlete.name,
          recruiterName: payload.recruiterName,
          organizationName: payload.organizationName,
          pitch: payload.pitch,
          conversationId: payload.conversationId,
        }).catch((err: unknown) => {
          this.logger.warn(
            `Failed to send connection-request email to ${athlete.email}: ${String(err)}`,
          );
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to notify athlete ${payload.athleteId} of connection request`,
        err,
      );
    }
  }
}
