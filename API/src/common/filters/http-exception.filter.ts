import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { errorResponse } from '../utils/api-response-utils';

// The API will use ApiError instead of HttpException because it uses ApiErrorValues, which are more specific and
// can be used by the frontend as codes to give more specific error messages.
//
// If an HttpException is thrown (either by Nest's internal modules or in curcumstances where ApiError cannot be
// used somehow), this filter will catch it and attempt to give it a ApiErrorValues value, and will give it
// "ERR_UNKNOWN" if it cannot be determined.
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    // const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Give a more specific error value for exceptions whose cause can be described by the values

    if (exception instanceof NotFoundException) {
      response
        .status(status)
        .json(errorResponse(exception.message, 'ERR_RESOURCE_NOT_FOUND'));
      return;
    }

    // TODO: Log the exception
    console.log('- UNHANDLED HTTP EXCEPTION: ', exception);

    response
      .status(status)
      .json(errorResponse(exception.message, 'ERR_UNKNOWN'));
  }
}
