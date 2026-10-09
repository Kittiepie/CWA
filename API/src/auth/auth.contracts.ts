import { AuthState } from 'src/common/lib/types/AuthState';
import {
  AuthSessionDto,
  AuthSessionEntity,
} from './entity/auth-session.entity';

export interface AuthSessionValidator {
  authenticateParticipant(participantId: string): Promise<{
    authSession: AuthSessionEntity;
    refreshToken: string;
  }>;

  verifyAndRefreshTokenAndAuthSession(
    refreshToken: string,
  ): Promise<AuthSessionEntity>;

  refreshByAuthSession(authSession: AuthSessionDto): Promise<AuthState>;
}

export const AUTH_SESSION_VALIDATOR = Symbol('AUTH_SESSION_VALIDATOR');
