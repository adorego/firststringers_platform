import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getConversationsForRecruiter(recruiterId: string) {
    return this.prisma.directConversation.findMany({
      where: { recruiterId },
      include: {
        athlete: {
          select: { id: true, name: true, sport: true, position: true, dossier: { select: { data: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversationsForAthlete(athleteId: string) {
    return this.prisma.directConversation.findMany({
      where: { athleteId, status: 'accepted' },
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPendingRequestsForAthlete(athleteId: string) {
    return this.prisma.directConversation.findMany({
      where: { athleteId, status: 'pending' },
      include: {
        recruiter: {
          select: {
            id: true,
            name: true,
            email: true,
            pitch: true,
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequest(recruiterId: string, athleteId: string) {
    return this.prisma.directConversation.upsert({
      where: { recruiterId_athleteId: { recruiterId, athleteId } },
      create: { recruiterId, athleteId, status: 'pending' },
      update: {},
      include: {
        athlete: { select: { id: true, name: true, sport: true, position: true } },
        recruiter: {
          select: {
            id: true,
            name: true,
            email: true,
            organization: { select: { name: true } },
          },
        },
      },
    });
  }

  // Keep for internal use (e.g. existing conversations REST endpoint)
  async getOrCreateConversation(recruiterId: string, athleteId: string) {
    return this.createRequest(recruiterId, athleteId);
  }

  async acceptRequest(conversationId: string, athleteId: string) {
    const conv = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.athleteId !== athleteId) throw new ForbiddenException('Not your conversation');
    if (conv.status === 'accepted') return conv;

    return this.prisma.directConversation.update({
      where: { id: conversationId },
      data: { status: 'accepted' },
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async declineRequest(conversationId: string, athleteId: string) {
    const conv = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.athleteId !== athleteId) throw new ForbiddenException('Not your conversation');

    return this.prisma.directConversation.update({
      where: { id: conversationId },
      data: { status: 'declined' },
    });
  }

  async getMessages(conversationId: string, limit = 50, before?: Date) {
    return this.prisma.directMessage.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    senderRole: 'recruiter' | 'athlete',
    content: string,
  ) {
    const conv = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
      select: { status: true },
    });
    if (!conv || conv.status !== 'accepted') {
      throw new ForbiddenException('Conversation is not active');
    }

    const message = await this.prisma.directMessage.create({
      data: { conversationId, senderId, senderRole, content },
    });
    await this.prisma.directConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  async markRead(conversationId: string, readerRole: string) {
    await this.prisma.directMessage.updateMany({
      where: { conversationId, senderRole: { not: readerRole }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async countUnread(conversationId: string, readerRole: string) {
    return this.prisma.directMessage.count({
      where: { conversationId, senderRole: { not: readerRole }, readAt: null },
    });
  }
}
