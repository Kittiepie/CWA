import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';
import { errorResponse } from '../utils/api-response-utils';

@Catch()
export class UnknownExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // TODO: Log the exception
    console.error('- UNHANDLED EXCEPTION: ', exception);

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Unexpected error occurred', 'ERR_UNKNOWN'));
  }
}
