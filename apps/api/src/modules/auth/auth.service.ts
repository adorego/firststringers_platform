import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshSecret: string;
  private readonly OTP_EXPIRY_MINUTES = 10;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.refreshSecret =
      this.config.get<string>('JWT_REFRESH_SECRET') ||
      this.config.getOrThrow<string>('JWT_SECRET');
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      let athleteId: string | undefined;
      let recruiterId: string | undefined;

      if (dto.role === 'ATHLETE') {
        const defaultOrg = await tx.organization.upsert({
          where: { id: 'default-org' },
          update: {},
          create: { id: 'default-org', name: 'First Stringers' },
        });

        const athlete = await tx.athlete.create({
          data: {
            email: dto.email,
            name: dto.name,
            organizationId: defaultOrg.id,
          },
        });
        athleteId = athlete.id;
      }

      if (dto.role === 'RECRUITER') {
        const defaultOrg = await tx.organization.upsert({
          where: { id: 'default-org' },
          update: {},
          create: { id: 'default-org', name: 'First Stringers' },
        });

        const recruiter = await tx.recruiter.create({
          data: {
            email: dto.email,
            name: dto.name,
            organizationId: defaultOrg.id,
          },
        });
        recruiterId = recruiter.id;
      }

      return tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: dto.role || 'ATHLETE',
          athleteId,
          recruiterId,
        },
      });
    });

    const tokens = this.generateTokens(user.id, user.email, user.role, dto.name, user.athleteId, user.recruiterId);

    // Fire OTP asynchronously — don't block registration
    void this.sendOtp(user.id).catch(() => {});

    return tokens;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        athlete: { select: { name: true } },
        recruiter: { select: { name: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const name = user.athlete?.name ?? user.recruiter?.name ?? user.email;
    return this.generateTokens(user.id, user.email, user.role, name, user.athleteId, user.recruiterId);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{
        sub: string;
        email: string;
        role: string;
        name: string;
        type: string;
      }>(refreshToken, {
        secret: this.refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          athlete: { select: { name: true } },
          recruiter: { select: { name: true } },
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const name = user.athlete?.name ?? user.recruiter?.name ?? payload.name ?? user.email;
      return this.generateTokens(user.id, user.email, user.role, name, user.athleteId, user.recruiterId);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async sendOtp(userId: string): Promise<{ sent: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.emailVerified) {
      return { sent: true }; // already verified, no-op
    }

    // Delete any existing codes for this user
    await this.prisma.verificationCode.deleteMany({
      where: { userId },
    });

    // Generate 6-digit code
    const plainCode = String(randomInt(100000, 999999));
    const hashedCode = await bcrypt.hash(plainCode, 10);

    await this.prisma.verificationCode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt: new Date(
          Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
        ),
      },
    });

    // TODO: Replace with real email provider (Resend, SendGrid, etc.)
    this.logger.log(
      `[EMAIL VERIFICATION] Code for ${user.email}: ${plainCode}`,
    );

    return { sent: true };
  }

  async verifyEmail(
    userId: string,
    code: string,
  ): Promise<{ verified: true }> {
    const records = await this.prisma.verificationCode.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (records.length === 0) {
      throw new BadRequestException('No verification code found. Request a new one.');
    }

    const record = records[0];

    if (record.expiresAt < new Date()) {
      await this.prisma.verificationCode.delete({
        where: { id: record.id },
      });
      throw new BadRequestException('Code expired. Request a new one.');
    }

    const valid = await bcrypt.compare(code, record.code);
    if (!valid) {
      throw new BadRequestException('Invalid code.');
    }

    // Mark verified + cleanup
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationCode.deleteMany({
        where: { userId },
      }),
    ]);

    return { verified: true };
  }

  private generateTokens(
    userId: string,
    email: string,
    role: string,
    name: string,
    athleteId?: string | null,
    recruiterId?: string | null,
  ) {
    const baseClaims = {
      sub: userId,
      email,
      role,
      name,
      ...(athleteId && { athleteId }),
      ...(recruiterId && { recruiterId }),
    };

    return {
      access_token: this.jwt.sign(
        { ...baseClaims, type: 'access' },
        { expiresIn: '30m' },
      ),
      refresh_token: this.jwt.sign(
        { ...baseClaims, type: 'refresh' },
        {
          secret:
            this.config.get<string>('JWT_REFRESH_SECRET') ||
            this.config.get<string>('JWT_SECRET'),
          expiresIn: '30d',
        },
      ),
    };
  }
}
