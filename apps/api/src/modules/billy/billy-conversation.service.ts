import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BillyMessage, SearchCriteria } from '../../shared/types/billy.types';
import type { Prisma } from '@firststringers/database';

export interface BillyConversationSummary {
  id: string;
  recruiterId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: { role: string; content: string; timestamp: Date } | null;
}

@Injectable()
export class BillyConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    recruiterId: string,
  ): Promise<{ id: string; recruiterId: string; title: string }> {
    const conv = await this.prisma.billyConversation.create({
      data: { recruiterId, title: 'New search' },
    });
    return { id: conv.id, recruiterId: conv.recruiterId, title: conv.title };
  }

  async findAll(recruiterId: string): Promise<BillyConversationSummary[]> {
    const convs = await this.prisma.billyConversation.findMany({
      where: { recruiterId },
      orderBy: { updatedAt: 'desc' },
    });

    return convs.map((c) => {
      const messages = (c.messages as BillyMessage[] | null) ?? [];
      const lastMessage =
        messages.length > 0 ? messages[messages.length - 1] : null;
      return {
        id: c.id,
        recruiterId: c.recruiterId,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastMessage: lastMessage
          ? {
              role: lastMessage.role,
              content: lastMessage.content,
              timestamp: lastMessage.timestamp,
            }
          : null,
      };
    });
  }

  async getMessages(conversationId: string): Promise<BillyMessage[]> {
    const conv = await this.prisma.billyConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) return [];
    return (conv.messages as BillyMessage[] | null) ?? [];
  }

  async getSearchCriteria(
    conversationId: string,
  ): Promise<Partial<SearchCriteria>> {
    const conv = await this.prisma.billyConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) return {};
    return (conv.searchCriteria as Partial<SearchCriteria> | null) ?? {};
  }

  async persistMessages(
    conversationId: string,
    messages: BillyMessage[],
    searchCriteria: Partial<SearchCriteria>,
  ): Promise<void> {
    await this.prisma.billyConversation.update({
      where: { id: conversationId },
      data: {
        messages: messages as unknown as Prisma.InputJsonValue,
        searchCriteria: searchCriteria as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    await this.prisma.billyConversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  async delete(conversationId: string): Promise<void> {
    await this.prisma.billyConversation.delete({
      where: { id: conversationId },
    });
  }
}
