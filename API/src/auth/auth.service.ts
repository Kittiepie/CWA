import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { RefreshTokenPayload } from './types/RefreshToken';
import { ApiError } from 'src/common/lib/errors/ApiError';
import { compareToken, hashToken } from 'src/common/utils/token-hash-utils';
import { AuthSessionValidator } from './auth.contracts';
import { USER_READER, type UserReader } from 'src/user/user.contracts';
import {
  AuthSessionDto,
  AuthSessionEntity,
} from './entity/auth-session.entity';
import { type AuthState } from 'src/common/lib/types/AuthState';
import {
  PARTICIPANT_READER,
  type ParticipantReader,
} from 'src/room/room.contracts';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService implements AuthSessionValidator {
  private readonly refreshTokenExpirationSeconds: number;
  private readonly accessTokenExpirationSeconds: number;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AuthSessionEntity)
    private authSessionsRepository: Repository<AuthSessionEntity>,
    private jwtService: JwtService,
    @Inject(USER_READER)
    private readonly userReader: UserReader,
    @Inject(PARTICIPANT_READER)
    private readonly participantReader: ParticipantReader,
  ) {
    const refreshTokenExpirationSeconds = this.config.getOrThrow<number>(
      'REFRESH_TOKEN_EXPIRATION_SECONDS',
    );
    this.refreshTokenExpirationSeconds = refreshTokenExpirationSeconds;

    const accessTokenExpirationSeconds = this.config.getOrThrow<number>(
      'ACCESS_TOKEN_EXPIRATION_SECONDS',
    );
    this.accessTokenExpirationSeconds = accessTokenExpirationSeconds;
  }

  async createAuthSession(
    participantId: string,
    uuid: string,
    tokenHash: string,
    expiresAt: Date,
    deviceInfo: string,
  ): Promise<AuthSessionEntity> {
    const authSession = new AuthSessionEntity();
    authSession.participantId = participantId;
    authSession.uuid = uuid;
    authSession.tokenHash = tokenHash;
    authSession.expiresAt = expiresAt;
    authSession.revoked = false;
    authSession.deviceInfo = deviceInfo;

    await this.authSessionsRepository.save(authSession);

    return authSession;
  }

  async authenticateParticipant(participantId: string): Promise<{
    authSession: AuthSessionEntity;
    refreshToken: string;
  }> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.refreshTokenExpirationSeconds * 1000,
    );

    const uuid = randomUUID();
    const refreshToken = await this.jwtService.signAsync<RefreshTokenPayload>(
      { uuid },
      { expiresIn: this.refreshTokenExpirationSeconds },
    );

    const tokenHash = await hashToken(refreshToken);

    // TODO: Add device info
    const createdSession = await this.createAuthSession(
      participantId,
      uuid,
      tokenHash,
      expiresAt,
      'temp',
    );

    return {
      authSession: createdSession,
      refreshToken,
    };
  }

  async verifyAndRefreshTokenAndAuthSession(
    refreshToken: string,
  ): Promise<AuthSessionEntity> {
    try {
      const { uuid } =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken);

      const authSession = await this.authSessionsRepository.findOne({
        where: { uuid },
        relations: {
          participant: true,
        },
      });

      if (!authSession) {
        throw new Error('Auth session not found');
      }

      if (authSession.revoked) {
        throw new Error('Auth session revoked');
      }

      if (authSession.expiresAt < new Date()) {
        throw new Error('Auth session expired');
      }

      const isTokenSameAsSaved = await compareToken(
        refreshToken,
        authSession.tokenHash,
      );
      if (!isTokenSameAsSaved) {
        throw new Error(
          'Refresh token not the same as the one saved on the database',
        );
      }

      // TODO: Handle device info

      return authSession;
    } catch {
      throw new ApiError(
        'Invalid refresh token',
        HttpStatus.UNAUTHORIZED,
        'ERR_SESSION_EXPIRED_OR_INVALID',
      );
    }
  }

  async refreshByAuthSession(authSession: AuthSessionDto): Promise<AuthState> {
    const participant = await this.participantReader.findParticipantById(
      authSession.participantId,
    );

    if (!participant) {
      throw new ApiError(
        'Participant not found',
        HttpStatus.NOT_FOUND,
        'ERR_PARTICIPANT_NOT_FOUND',
      );
    }

    const accessToken = await this.jwtService.signAsync(
      { participantId: participant.id },
      { expiresIn: this.accessTokenExpirationSeconds },
    );

    return {
      userDetails: participant.user?.toDto() ?? null,
      guestName: participant.guestName,
      participantId: participant.id,
      accessToken,
    };
  }
}
