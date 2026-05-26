import { Injectable } from '@nestjs/common';
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
      where: { athleteId },
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

  async getOrCreateConversation(recruiterId: string, athleteId: string) {
    return this.prisma.directConversation.upsert({
      where: { recruiterId_athleteId: { recruiterId, athleteId } },
      create: { recruiterId, athleteId },
      update: {},
      include: {
        athlete: { select: { id: true, name: true, sport: true, position: true } },
        recruiter: { select: { id: true, name: true, email: true } },
      },
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
