import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { LLMService } from '../../shared/llm/llm.service';

export interface RecruiterProfile {
  id: string;
  name: string;
  email: string;
  university: string | null;
  location: string | null;
  scholarshipType: string | null;
  sport: string | null;
  gender: string | null;
  division: string | null;
  openings: number | null;
  onboardingCompleted: boolean;
  pitch: string | null;
  verificationStatus: string;
  verificationTitle: string | null;
  verificationWebsite: string | null;
  verificationLinkedIn: string | null;
  verifiedAt: Date | null;
}

export interface UpdateRecruiterProfileDto {
  university?: string;
  location?: string;
  scholarshipType?: string;
  sport?: string;
  gender?: string;
  division?: string;
  openings?: number;
  onboardingCompleted?: boolean;
  pitch?: string;
}

@Injectable()
export class RecruiterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
  ) {}

  async findById(id: string): Promise<RecruiterProfile | null> {
    const recruiter = await this.prisma.recruiter.findUnique({ where: { id } });
    if (!recruiter) return null;

    if (!recruiter.pitch && recruiter.university) {
      const pitch = await this.generatePitch(recruiter);
      await this.prisma.recruiter.update({ where: { id }, data: { pitch } });
      return { ...recruiter, pitch };
    }

    return recruiter;
  }

  private async generatePitch(recruiter: RecruiterProfile): Promise<string> {
    const lines = [
      recruiter.university && `University: ${recruiter.university}`,
      recruiter.location && `Location: ${recruiter.location}`,
      recruiter.scholarshipType && `Scholarship: ${recruiter.scholarshipType}`,
      recruiter.sport && `Sport: ${recruiter.sport}`,
      recruiter.division && `Division: ${recruiter.division}`,
      recruiter.openings && `Open spots: ${recruiter.openings}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      return await this.llm.chat({
        systemPrompt:
          'Write a 2–3 sentence introduction for a college sports recruiter that will be shown to an athlete receiving a connection request. Be specific, warm, and professional. Highlight what makes the program attractive. No quotes, no bullet points — flowing text only.',
        messages: [{ role: 'user', content: `Program details:\n${lines}`, timestamp: new Date() }],
      });
    } catch {
      return '';
    }
  }

  async updateProfile(id: string, data: UpdateRecruiterProfileDto): Promise<void> {
    const exists = await this.prisma.recruiter.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Recruiter not found');
    await this.prisma.recruiter.update({ where: { id }, data });
  }

  async submitVerification(
    recruiterId: string,
    data: { title?: string; website?: string; linkedIn?: string },
  ): Promise<{ verificationStatus: string }> {
    const recruiter = await this.prisma.recruiter.findUnique({
      where: { id: recruiterId },
    });
    if (!recruiter) throw new NotFoundException('Recruiter not found');

    await this.prisma.recruiter.update({
      where: { id: recruiterId },
      data: {
        verificationTitle: data.title?.trim() || null,
        verificationWebsite: data.website?.trim() || null,
        verificationLinkedIn: data.linkedIn?.trim() || null,
        verificationStatus: 'under_review',
      },
    });

    return { verificationStatus: 'under_review' };
  }

  // Admin-only: approve or reject a recruiter
  async setVerificationStatus(
    recruiterId: string,
    status: 'verified' | 'rejected',
  ): Promise<void> {
    const recruiter = await this.prisma.recruiter.findUnique({
      where: { id: recruiterId },
    });
    if (!recruiter) throw new NotFoundException('Recruiter not found');

    await this.prisma.recruiter.update({
      where: { id: recruiterId },
      data: {
        verificationStatus: status,
        verifiedAt: status === 'verified' ? new Date() : null,
      },
    });
  }

  async listPendingVerifications() {
    return this.prisma.recruiter.findMany({
      where: { verificationStatus: 'under_review' },
      select: {
        id: true,
        name: true,
        email: true,
        university: true,
        verificationTitle: true,
        verificationWebsite: true,
        verificationLinkedIn: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
