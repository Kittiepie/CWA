import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { LoginDto } from './dto/LoginDto';
import { ApiResponse } from 'src/common/lib/ApiResponse';
import { successResponse } from 'src/common/utils/api-response-utils';
import { EMAIL_REGEX } from 'src/common/lib/regex/email.regex';
import { type Request, type Response } from 'express';
import { REFRESH_TOKEN_COOKIE_NAME } from 'src/common/constants';
import { ApiError } from 'src/common/lib/errors/ApiError';
import { RegisterDto } from './dto/RegisterDto';
import check from 'check-types';
import {
  AUTH_SESSION_VALIDATOR,
  type AuthSessionValidator,
} from './auth.contracts';
import {
  USER_AUTHENTICATOR,
  USER_WRITER,
  type UserAuthenticator,
  type UserWriter,
} from 'src/user/user.contracts';
import { AuthState } from 'src/common/lib/types/AuthState';
import { UserDetails } from 'src/common/lib/types/dto/UserDetails';
import {
  PARTICIPANT_WRITER,
  type ParticipantWriter,
} from 'src/room/room.contracts';
import { generateGuestName } from 'src/common/utils/generateGuestName';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SESSION_VALIDATOR)
    private readonly authSessionValidator: AuthSessionValidator,
    @Inject(USER_WRITER)
    private readonly userWriter: UserWriter,
    @Inject(USER_AUTHENTICATOR)
    private readonly userAuthenticator: UserAuthenticator,
    @Inject(PARTICIPANT_WRITER)
    private readonly participantWriter: ParticipantWriter,
  ) { }

  @Post('login')
  async login(
    @Body() form: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<ApiResponse<UserDetails>> {
    const { loginKey, password } = form;

    // Handle login using email
    if (EMAIL_REGEX.test(loginKey)) {
      const user = await this.userAuthenticator.loginWithEmail(
        loginKey,
        password,
      );

      // If user is not linked to a participant, create a new participant for the user.
      if (!user.participant) {
        const participant = await this.participantWriter.createParticipant({
          userId: user.id,
          guestName: generateGuestName(),
          lastAccessIp: req.ip ?? null,
        });

        console.log(
          `Created participant ${participant.id} for user ${user.id}`,
        );

        user.participant = participant;
      }

      const { refreshToken } =
        await this.authSessionValidator.authenticateParticipant(
          user.participant.id,
        );

      res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken);

      res.status(200);

      return successResponse('Login successful', {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    }

    throw new ApiError(
      'Invalid login credentials',
      HttpStatus.UNAUTHORIZED,
      'ERR_INVALID_CREDENTIALS',
    );
  }

  @Post('register')
  async register(
    @Body() form: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<ApiResponse<UserDetails>> {
    const { name, email, password } = form;

    const user = await this.userWriter.createUser(
      { name, email, role: 'user' },
      password,
    );

    // For now create a new participant for the registering user, might allow users to link to an existing
    // participant in the future.

    const participant = await this.participantWriter.createParticipant({
      userId: user.id,
      guestName: generateGuestName(),
      lastAccessIp: req.ip ?? null,
    });

    const { refreshToken } =
      await this.authSessionValidator.authenticateParticipant(participant.id);

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken);

    return successResponse('Register successful', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }

  @Get('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<AuthState>> {
    const { [REFRESH_TOKEN_COOKIE_NAME]: refreshToken } = req.cookies as {
      [REFRESH_TOKEN_COOKIE_NAME]?: string;
    };

    try {
      if (check.string(refreshToken)) {
        // If refresh token is present and is a string, user is assumed to be an existing participant/user

        const authSession =
          await this.authSessionValidator.verifyAndRefreshTokenAndAuthSession(
            refreshToken,
          );
        const authState =
          await this.authSessionValidator.refreshByAuthSession(authSession);

        await this.participantWriter.setParticipantLastAccessIp(
          authSession.participant.id,
          req.ip ?? 'unknown',
        );

        return successResponse(
          'Authenticated as existing participant',
          authState,
        );
      } else {
        // If refresh token is not present, user is assumed to be visiting the page for the first time.
        // Create a participant, an auth session, set the refresh token, and return the access token for the user.

        const participant = await this.participantWriter.createParticipant({
          userId: null,
          guestName: generateGuestName(),
          lastAccessIp: req.ip ?? null,
        });

        const { refreshToken } =
          await this.authSessionValidator.authenticateParticipant(
            participant.id,
          );

        const authSession =
          await this.authSessionValidator.verifyAndRefreshTokenAndAuthSession(
            refreshToken,
          );

        const { accessToken } =
          await this.authSessionValidator.refreshByAuthSession(authSession);

        res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken);

        return successResponse('Authenticated as new participant', {
          userDetails: null,
          guestName: participant.guestName,
          participantId: participant.id,
          accessToken,
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.error === 'ERR_SESSION_EXPIRED_OR_INVALID') {
          res.clearCookie(REFRESH_TOKEN_COOKIE_NAME);
          res.redirect((process.env.WEB_URL ?? '') + '/auth/login');
        }
      }

      throw error;
    }
  }
}
