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
import { Public } from '../auth/public.decorator';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { BillySessionService } from './billy-session.service';
import { BillyMessage, BillyMessageJob } from '../../shared/types/billy.types';

@Public()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/billy',
})
export class BillyGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BillyGateway.name);
  private connectedRecruiters = new Map<string, string>(); // socketId -> recruiterId

  constructor(
    @InjectQueue('billy') private readonly billyQueue: Queue,
    private readonly session: BillySessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const recruiterId = client.handshake.query.recruiterId as string;

      if (!recruiterId) {
        client.disconnect();
        return;
      }

      // Evict any stale sockets for this recruiter (e.g. React StrictMode double-mount)
      for (const [sid, rid] of this.connectedRecruiters.entries()) {
        if (rid === recruiterId && sid !== client.id) {
          const stale = this.server.sockets.sockets.get(sid);
          stale?.leave(`recruiter:${recruiterId}`);
          this.connectedRecruiters.delete(sid);
        }
      }

      this.connectedRecruiters.set(client.id, recruiterId);
      client.join(`recruiter:${recruiterId}`);

      this.logger.log(
        `Recruiter ${recruiterId} connected — socket ${client.id}`,
      );

      const session = await this.session.getSession(recruiterId);

      if (session.messages.length > 0) {
        // Resume existing session — send history
        client.emit('session_resumed', {
          messages: session.messages,
          searchCriteria: session.searchCriteria,
        });
      } else {
        // New session — send welcome
        const welcomeMessage: BillyMessage = {
          role: 'assistant',
          content:
            "Hi! I'm Billy, your recruiting intelligence agent. Tell me what kind of athlete you're looking for and I'll help you find the best matches. What sport and position are you recruiting for?",
          timestamp: new Date(),
        };
        await this.session.appendMessage(recruiterId, welcomeMessage);
        client.emit('message', welcomeMessage);
      }
    } catch (err) {
      this.logger.error(`Connection error for socket ${client.id}`, err);
      client.emit('error', {
        code: 'CONNECTION_ERROR',
        message: 'Connection error',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const recruiterId = this.connectedRecruiters.get(client.id);
    this.connectedRecruiters.delete(client.id);
    if (recruiterId) {
      this.logger.log(`Recruiter ${recruiterId} disconnected`);
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { content: string },
  ) {
    const recruiterId = this.connectedRecruiters.get(client.id);

    if (!recruiterId) {
      client.emit('error', {
        code: 'UNAUTHENTICATED',
        message: 'Not authenticated',
      });
      return;
    }

    try {
      const userMessage: BillyMessage = {
        role: 'user',
        content: dto.content,
        timestamp: new Date(),
      };
      await this.session.appendMessage(recruiterId, userMessage);

      // Signal typing indicator
      client.emit('status', { status: 'typing' });

      const job: BillyMessageJob = {
        recruiterId,
        message: dto.content,
      };

      await this.billyQueue.add('process.message', job, {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch (err) {
      this.logger.error(
        `Error handling message for recruiter ${recruiterId}`,
        err,
      );
      client.emit('error', {
        code: 'MESSAGE_ERROR',
        message: 'Error processing message',
      });
    }
  }

  @OnEvent('billy.response')
  handleBillyResponse(payload: {
    recruiterId: string;
    message: string;
    searchCriteria?: Record<string, unknown>;
    searchResults?: unknown[];
  }) {
    this.server.to(`recruiter:${payload.recruiterId}`).emit('message', {
      role: 'assistant',
      content: payload.message,
      timestamp: new Date(),
      searchCriteria: payload.searchCriteria,
      searchResults: payload.searchResults,
    });

    if (payload.searchCriteria) {
      this.server
        .to(`recruiter:${payload.recruiterId}`)
        .emit('criteria_updated', { criteria: payload.searchCriteria });
    }

    if (payload.searchResults) {
      this.server
        .to(`recruiter:${payload.recruiterId}`)
        .emit('search_results', { results: payload.searchResults });
    }
  }

  @OnEvent('billy.error')
  handleBillyError(payload: { recruiterId: string; error: string }) {
    this.server
      .to(`recruiter:${payload.recruiterId}`)
      .emit('error', { code: 'PROCESSING_ERROR', message: payload.error });
  }
}