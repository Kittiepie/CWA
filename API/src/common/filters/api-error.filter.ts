import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ApiError } from '../lib/errors/ApiError';
import { errorResponse } from '../utils/api-response-utils';
import { Response } from 'express';

@Catch(ApiError)
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: ApiError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response
      .status(exception.statusCode)
      .json(errorResponse(exception.message, exception.error));
  }
}
