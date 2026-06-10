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
import { Public } from '../auth/public.decorator';
import { ConversationsService } from './conversations.service';

interface ClientInfo {
  userId: string;
  role: 'recruiter' | 'athlete';
}

@Public()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/conversations',
})
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConversationsGateway.name);
  private clients = new Map<string, ClientInfo>();

  constructor(private readonly conversationsService: ConversationsService) {}

  handleConnection(client: Socket) {
    const recruiterId = client.handshake.query.recruiterId as string;
    const athleteId = client.handshake.query.athleteId as string;

    if (!recruiterId && !athleteId) {
      client.disconnect();
      return;
    }

    const info: ClientInfo = recruiterId
      ? { userId: recruiterId, role: 'recruiter' }
      : { userId: athleteId, role: 'athlete' };

    this.clients.set(client.id, info);
    client.join(`user:${info.userId}`);
    this.logger.log(`${info.role} ${info.userId} connected to conversations`);
  }

  handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    if (info) this.logger.log(`${info.role} ${info.userId} disconnected`);
    this.clients.delete(client.id);
  }

  @SubscribeMessage('join_conversation')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { conversationId: string },
  ) {
    client.join(`conv:${dto.conversationId}`);

    const messages = await this.conversationsService.getMessages(dto.conversationId);
    client.emit('history', messages);

    const info = this.clients.get(client.id);
    if (info) {
      await this.conversationsService.markRead(dto.conversationId, info.role);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { conversationId: string; content: string },
  ) {
    const info = this.clients.get(client.id);
    if (!info || !dto.content?.trim()) return;

    const message = await this.conversationsService.sendMessage(
      dto.conversationId,
      info.userId,
      info.role,
      dto.content.trim(),
    );

    this.server.to(`conv:${dto.conversationId}`).emit('message', message);
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { conversationId: string },
  ) {
    const info = this.clients.get(client.id);
    if (!info) return;
    await this.conversationsService.markRead(dto.conversationId, info.role);
  }
}
