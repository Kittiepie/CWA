import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AccessTokenPayload } from 'src/auth/types/AccessToken';
import { ApiError } from '../lib/errors/ApiError';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new ApiError(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
        'ERR_AUTHENTICATION_REQUIRED',
      );
    }
    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      const authenticatedRequest = request as AuthenticatedRequest;

      authenticatedRequest.participantId = payload.participantId;
    } catch {
      throw new ApiError(
        'Invalid token',
        HttpStatus.UNAUTHORIZED,
        'ERR_INVALID_CREDENTIALS',
      );
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
