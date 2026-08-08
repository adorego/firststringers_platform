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
import { JerryPitchService } from '../jerry/jerry-pitch.service';
import { ConversationsService } from '../conversations/conversations.service';
import { RecruiterService } from '../recruiter/recruiter.service';

interface ClientContext {
  recruiterId: string;
  conversationId: string;
}

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
  private clients = new Map<string, ClientContext>(); // socketId -> context

  constructor(
    @InjectQueue('billy') private readonly billyQueue: Queue,
    private readonly session: BillySessionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly jerryPitch: JerryPitchService,
    private readonly conversations: ConversationsService,
    private readonly recruiterService: RecruiterService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const recruiterId = client.handshake.query.recruiterId as string;
      const conversationId = client.handshake.query.conversationId as string;

      if (!recruiterId || !conversationId) {
        client.disconnect();
        return;
      }

      // Evict stale sockets for this conversation
      for (const [sid, ctx] of this.clients.entries()) {
        if (ctx.conversationId === conversationId && sid !== client.id) {
          const stale = this.server.sockets.sockets.get(sid);
          // Fire-and-forget: socket.io types join/leave as Promise<void> to
          // support distributed adapters, but the in-memory adapter used
          // here resolves synchronously — nothing to await.
          void stale?.leave(`conversation:${conversationId}`);
          this.clients.delete(sid);
        }
      }

      this.clients.set(client.id, { recruiterId, conversationId });
      void client.join(`conversation:${conversationId}`);

      this.logger.log(
        `Recruiter ${recruiterId} connected on conversation ${conversationId} — socket ${client.id}`,
      );

      const recruiter = await this.recruiterService.findById(recruiterId);
      const isOnboarding = !recruiter?.onboardingCompleted;

      const sessionState = await this.session.getSession(
        conversationId,
        recruiterId,
        isOnboarding,
      );

      if (sessionState.messages.length > 0) {
        client.emit('session_resumed', {
          messages: sessionState.messages,
          searchCriteria: sessionState.searchCriteria,
          isOnboarding: sessionState.isOnboarding,
        });
      } else {
        // A fresh conversation right after onboarding gets seeded with the
        // suggestions Billy generated from the recruiter's answers.
        const pendingSuggestions = !isOnboarding
          ? await this.session.getAndClearPendingSuggestions(recruiterId)
          : null;

        // Billy only introduces itself during onboarding (or when handing off
        // onboarding-derived suggestions). A plain new chat stays empty — the
        // centered placeholder already explains what to do, so no message is
        // needed here.
        if (
          isOnboarding ||
          (pendingSuggestions && pendingSuggestions.length > 0)
        ) {
          const welcomeMessage: BillyMessage = {
            role: 'assistant',
            content: isOnboarding
              ? `Hi${recruiter?.name ? ` ${recruiter.name}` : ''}.\n\nBefore we get started, I'd like to understand how you recruit and what decisions you're responsible for, so I can support you with better context.\n\nWhat sport are you recruiting for?\nYou can choose from: Football, Baseball, Basketball, Soccer, Volleyball, or Other.`
              : `Now that I know more about your program, here are a few searches to get you started.`,
            timestamp: new Date(),
          };
          await this.session.appendMessage(
            conversationId,
            recruiterId,
            welcomeMessage,
          );
          client.emit('message', welcomeMessage);
          if (isOnboarding) {
            client.emit('onboarding_started', {});
          }
          if (pendingSuggestions && pendingSuggestions.length > 0) {
            client.emit('onboarding_complete', {
              suggestedSearches: pendingSuggestions,
            });
          }
        }
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
    const ctx = this.clients.get(client.id);
    this.clients.delete(client.id);
    if (ctx) {
      this.logger.log(
        `Recruiter ${ctx.recruiterId} disconnected from conversation ${ctx.conversationId}`,
      );
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { content: string },
  ) {
    const ctx = this.clients.get(client.id);
    if (!ctx) {
      client.emit('error', {
        code: 'UNAUTHENTICATED',
        message: 'Not authenticated',
      });
      return;
    }

    const { recruiterId, conversationId } = ctx;

    try {
      const userMessage: BillyMessage = {
        role: 'user',
        content: dto.content,
        timestamp: new Date(),
      };
      await this.session.appendMessage(
        conversationId,
        recruiterId,
        userMessage,
      );

      client.emit('status', { status: 'typing' });

      const job: BillyMessageJob = {
        conversationId,
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
        `Error handling message for conversation ${conversationId}`,
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
    conversationId: string;
    message: string;
    searchCriteria?: Record<string, unknown>;
    searchResults?: unknown[];
    isFallbackRecommendation?: boolean;
    isExpandedSearch?: boolean;
  }) {
    this.server.to(`conversation:${payload.conversationId}`).emit('message', {
      role: 'assistant',
      content: payload.message,
      timestamp: new Date(),
      searchCriteria: payload.searchCriteria,
      searchResults: payload.searchResults,
      isFallbackRecommendation: payload.isFallbackRecommendation,
      isExpandedSearch: payload.isExpandedSearch,
    });

    if (payload.searchCriteria) {
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('criteria_updated', { criteria: payload.searchCriteria });
    }

    if (payload.searchResults) {
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('search_results', { results: payload.searchResults });
    }
  }

  @OnEvent('billy.onboarding_complete')
  handleOnboardingComplete(payload: {
    recruiterId: string;
    conversationId: string;
    newConversationId: string;
  }) {
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('onboarding_complete', {
        newConversationId: payload.newConversationId,
      });
  }

  @OnEvent('billy.error')
  handleBillyError(payload: { conversationId: string; error: string }) {
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('error', { code: 'PROCESSING_ERROR', message: payload.error });
  }

  @SubscribeMessage('contact_jerry')
  async handleContactJerry(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { athleteId: string },
  ) {
    const ctx = this.clients.get(client.id);
    if (!ctx) return;

    try {
      client.emit('status', { status: 'typing' });
      const { athleteName, pitch } = await this.jerryPitch.getPitchForRecruiter(
        dto.athleteId,
      );
      client.emit('jerry_pitch', {
        athleteName,
        pitch,
        athleteId: dto.athleteId,
      });

      const msg: BillyMessage = {
        role: 'assistant',
        content: pitch,
        timestamp: new Date(),
      };
      await this.session.appendMessage(
        ctx.conversationId,
        ctx.recruiterId,
        msg,
      );
    } catch (error) {
      this.logger.error('Error getting Jerry pitch', error);
      client.emit('message', {
        role: 'assistant',
        content: "I couldn't reach Jerry right now. Please try again.",
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('initiate_contact')
  async handleInitiateContact(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { athleteId: string; athleteName: string },
  ) {
    const ctx = this.clients.get(client.id);
    if (!ctx || !dto?.athleteId) return;

    client.emit('status', { status: 'typing' });

    try {
      // Gate: recruiter must be verified to contact athletes
      try {
        await this.conversations.assertRecruiterCanContact(ctx.recruiterId);
      } catch (err) {
        const message =
          err instanceof Error && 'message' in err
            ? err.message
            : 'You need to complete verification before contacting athletes.';
        client.emit('message', {
          role: 'assistant',
          content: `I can't send that request yet — ${message.toLowerCase()} Once verified, I'll be able to connect you with athletes right away.`,
          timestamp: new Date(),
        });
        return;
      }

      // Create a pending connection request
      const conversation = await this.conversations.createRequest(
        ctx.recruiterId,
        dto.athleteId,
      );

      const athleteName = conversation.athlete?.name ?? dto.athleteName;
      const recruiterName = conversation.recruiter?.name ?? 'A recruiter';
      const organizationName = conversation.recruiter?.organization?.name;

      const recruiterProfile = await this.recruiterService.findById(
        ctx.recruiterId,
      );
      const pitch = recruiterProfile?.pitch ?? undefined;

      // Tell Jerry so he can inform the athlete
      this.eventEmitter.emit('contact.initiated', {
        athleteId: dto.athleteId,
        athleteName,
        recruiterId: ctx.recruiterId,
        recruiterName,
        organizationName,
        conversationId: conversation.id,
        pitch,
      });

      const msg: BillyMessage = {
        role: 'assistant',
        content: `Done — I've sent a connection request to ${athleteName}. Jerry is letting them know right now. Once they accept, the conversation will open in your Connections panel.`,
        timestamp: new Date(),
      };

      await this.session.appendMessage(
        ctx.conversationId,
        ctx.recruiterId,
        msg,
      );
      client.emit('message', msg);
      client.emit('contact_initiated', {
        conversationId: conversation.id,
        athleteId: dto.athleteId,
        athleteName,
      });
    } catch (error) {
      this.logger.error(
        `Error initiating contact with athlete ${dto.athleteId}`,
        error,
      );
      client.emit('message', {
        role: 'assistant',
        content: `I couldn't set up the conversation with ${dto.athleteName} right now. Please try again in a moment.`,
        timestamp: new Date(),
      });
    }
  }
}
