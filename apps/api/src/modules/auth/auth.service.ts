import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;

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
      // Get or create the default organization for self-registered users
      const defaultOrg = await tx.organization.upsert({
        where: { id: 'default-org' },
        update: {},
        create: { id: 'default-org', name: 'First Stringers' },
      });

      let athleteId: string | undefined;
      let recruiterId: string | undefined;

      if (dto.role === 'ATHLETE') {
        const athlete = await tx.athlete.create({
          data: {
            email: dto.email,
            name: dto.name,
            organizationId: defaultOrg.id,
          },
        });
        athleteId = athlete.id;
      } else if (dto.role === 'RECRUITER') {
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

    return this.generateTokens(user.id, user.email, user.role, user.athleteId, user.recruiterId);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email, user.role, user.athleteId, user.recruiterId);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{
        sub: string;
        email: string;
        role: string;
        type: string;
      }>(refreshToken, {
        secret: this.refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.athleteId,
        user.recruiterId,
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(
    userId: string,
    email: string,
    role: string,
    athleteId?: string | null,
    recruiterId?: string | null,
  ) {
    const baseClaims = {
      sub: userId,
      email,
      role,
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
