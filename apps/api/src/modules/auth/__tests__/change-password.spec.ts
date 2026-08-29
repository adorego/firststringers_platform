import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';

describe('AuthService.changePassword', () => {
  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
  };

  let service: AuthService;
  let currentHash: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    currentHash = await bcrypt.hash('current-password', 12);
    service = new AuthService(
      mockPrisma as never,
      { signAsync: jest.fn() } as never,
      { get: jest.fn(), getOrThrow: jest.fn(() => 'test-secret') } as never,
      { sendWelcomeEmail: jest.fn(), sendOtpEmail: jest.fn() } as never,
    );
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: currentHash,
    });
    mockPrisma.user.update.mockResolvedValue({});
  });

  it('stores a new hash the athlete can log in with', async () => {
    await service.changePassword('user-1', {
      currentPassword: 'current-password',
      newPassword: 'a-brand-new-password',
    });

    const [args] = mockPrisma.user.update.mock.calls[0] as [
      { where: { id: string }; data: { password: string } },
    ];
    expect(args.where).toEqual({ id: 'user-1' });
    expect(args.data.password).not.toBe('a-brand-new-password');
    await expect(
      bcrypt.compare('a-brand-new-password', args.data.password),
    ).resolves.toBe(true);
  });

  it('rejects a wrong current password without touching the stored one', async () => {
    await expect(
      service.changePassword('user-1', {
        currentPassword: 'not-the-password',
        newPassword: 'a-brand-new-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses to reuse the current password', async () => {
    await expect(
      service.changePassword('user-1', {
        currentPassword: 'current-password',
        newPassword: 'current-password',
      }),
    ).rejects.toThrow(/different/i);

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('fails when the user no longer exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('ghost', {
        currentPassword: 'current-password',
        newPassword: 'a-brand-new-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
