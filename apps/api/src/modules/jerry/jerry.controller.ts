import { Controller, Get, Param, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { JerryMessage } from '../../shared/types';

interface ChatMessageResponse {
  id: string;
  sender: 'athlete' | 'jerry';
  content: string;
  timestamp: string;
  isAiGenerated?: boolean;
}

@Controller('chat')
export class JerryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':athleteId/messages')
  async getMessages(
    @Param('athleteId') athleteId: string,
    @CurrentUser() user: { id: string; role: string; athleteId: string | null },
  ): Promise<ChatMessageResponse[]> {
    if (user.role === 'ATHLETE' && user.athleteId !== athleteId) {
      throw new ForbiddenException('You can only view your own messages');
    }

    const session = await this.prisma.jerrySession.findFirst({
      where: { athleteId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return [];
    }

    const messages = session.messages as unknown as JerryMessage[];

    return messages.map((msg, i) => ({
      id: `${session.id}-${i}`,
      sender: msg.role === 'user' ? ('athlete' as const) : ('jerry' as const),
      content: msg.content,
      timestamp: new Date(msg.timestamp).toISOString(),
      isAiGenerated: msg.role === 'assistant',
    }));
  }
}
