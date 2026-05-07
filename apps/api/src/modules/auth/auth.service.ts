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
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

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

      if (dto.role === 'ATHLETE') {
        // Get or create the default organization for self-registered athletes
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

      return tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: dto.role || 'ATHLETE',
          athleteId,
        },
      });
    });

    return this.generateTokens(user.id, user.email, user.role);
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

    return this.generateTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{
        sub: string;
        email: string;
        role: string;
      }>(refreshToken, {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ||
          this.config.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    return {
      access_token: this.jwt.sign(payload, {
        expiresIn: '7d',
      }),
      refresh_token: this.jwt.sign(payload, {
        secret:
          this.config.get<string>('JWT_REFRESH_SECRET') ||
          this.config.get<string>('JWT_SECRET'),
        expiresIn: '30d',
      }),
    };
  }
}
