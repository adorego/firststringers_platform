import {
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RecruiterService } from '../recruiter/recruiter.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recruiterService: RecruiterService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mail: MailService,
  ) {}

  async getCountsForRecruiter(recruiterId: string): Promise<{
    connections: number;
    introductions: number;
    unreadConnections: number;
  }> {
    const [connections, introductions, unreadConnections] = await Promise.all([
      this.prisma.directConversation.count({
        where: { recruiterId, status: 'accepted' },
      }),
      this.prisma.directConversation.count({
        where: { recruiterId, status: 'pending' },
      }),
      this.prisma.directConversation.count({
        where: {
          recruiterId,
          status: 'accepted',
          messages: { some: { senderRole: 'athlete', readAt: null } },
        },
      }),
    ]);
    return { connections, introductions, unreadConnections };
  }

  async getCountsForAthlete(
    athleteId: string,
  ): Promise<{ unreadConnections: number }> {
    const unreadConnections = await this.prisma.directConversation.count({
      where: {
        athleteId,
        status: 'accepted',
        messages: { some: { senderRole: 'recruiter', readAt: null } },
      },
    });
    return { unreadConnections };
  }

  async getConversationsForRecruiter(recruiterId: string) {
    return this.prisma.directConversation.findMany({
      where: { recruiterId, status: 'accepted' },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            sport: true,
            position: true,
            dossier: { select: { data: true } },
          },
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

  async assertRecruiterCanContact(recruiterId: string): Promise<void> {
    const recruiter = await this.prisma.recruiter.findUnique({
      where: { id: recruiterId },
      select: {
        onboardingCompleted: true,
        verificationStatus: true,
      },
    });

    if (!recruiter) {
      throw new NotFoundException('Recruiter not found');
    }

    if (!recruiter.onboardingCompleted) {
      throw new ForbiddenException(
        'Complete your onboarding with Billy before contacting athletes',
      );
    }

    // TODO: re-enable once we're past early testing — any verified-email account
    // should be able to search and contact athletes for now.
    // if (recruiter.verificationStatus !== 'verified') {
    //   throw new ForbiddenException(
    //     'Your account must be verified before contacting athletes',
    //   );
    // }
  }

  async createRequest(recruiterId: string, athleteId: string) {
    await this.assertRecruiterCanContact(recruiterId);

    return this.prisma.directConversation.upsert({
      where: { recruiterId_athleteId: { recruiterId, athleteId } },
      create: { recruiterId, athleteId, status: 'pending' },
      update: {},
      include: {
        athlete: {
          select: { id: true, name: true, sport: true, position: true },
        },
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

  // REST counterpart of BillyGateway.handleInitiateContact — used when a recruiter
  // requests an introduction from outside an active Billy conversation (Pipeline, Dossier).
  async requestIntroduction(recruiterId: string, athleteId: string) {
    const conversation = await this.createRequest(recruiterId, athleteId);
    const recruiterProfile = await this.recruiterService.findById(recruiterId);

    this.eventEmitter.emit('contact.initiated', {
      athleteId,
      athleteName: conversation.athlete?.name,
      recruiterId,
      recruiterName: conversation.recruiter?.name ?? 'A recruiter',
      organizationName: conversation.recruiter?.organization?.name,
      conversationId: conversation.id,
      pitch: recruiterProfile?.pitch ?? undefined,
    });

    return conversation;
  }

  async acceptRequest(conversationId: string, athleteId: string) {
    const conv = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.athleteId !== athleteId)
      throw new ForbiddenException('Not your conversation');
    if (conv.status === 'accepted') return conv;

    const updated = await this.prisma.directConversation.update({
      where: { id: conversationId },
      data: { status: 'accepted' },
      include: {
        recruiter: { select: { id: true, name: true, email: true } },
        athlete: { select: { name: true } },
      },
    });

    if (updated.recruiter?.email) {
      void this.mail
        .sendConnectionAcceptedEmail({
          to: updated.recruiter.email,
          athleteName: updated.athlete?.name ?? 'An athlete',
          conversationId,
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `Failed to send connection-accepted email to ${updated.recruiter?.email}: ${String(err)}`,
          );
        });
    }

    return updated;
  }

  async declineRequest(conversationId: string, athleteId: string) {
    const conv = await this.prisma.directConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.athleteId !== athleteId)
      throw new ForbiddenException('Not your conversation');

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
