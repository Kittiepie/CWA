import { Controller, Get, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { type ApiResponse } from './common/lib/ApiResponse';
import { successResponse } from './common/utils/api-response-utils';
import { ApiError } from './common/lib/errors/ApiError';
import { type AuthenticatedRequest } from './common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get('health')
  async healthCheck(): Promise<
    ApiResponse<{ status: string; uptime: number }>
  > {
    const error = await this.appService.healthCheck();

    if (error !== null) {
      throw new ApiError(
        'Server is not healthy',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }
    return successResponse('Server is healthy', {
      status: 'ok',
      uptime: process.uptime(),
    });
  }

  @Get('test')
  @UseGuards(JwtAuthGuard)
  async test(@Req() req: AuthenticatedRequest): Promise<ApiResponse<string>> {
    return Promise.resolve(
      successResponse('Test successful', `test as user ${req.participantId}`),
    );
  }
}
