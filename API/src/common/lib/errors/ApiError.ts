import { ApiErrorValues } from './ApiErrorValues';

export class ApiError extends Error {
  statusCode: number;
  error: ApiErrorValues;

  constructor(message: string, statusCode: number, error: ApiErrorValues) {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
