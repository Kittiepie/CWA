import { ApiResponse } from '../lib/ApiResponse';
import { ApiErrorValues } from '../lib/errors/ApiErrorValues';

export const successResponse = <T>(
  message: string,
  data: T,
): ApiResponse<T> => {
  return {
    success: true,
    message,
    data,
  };
};

export const errorResponse = (
  message: string,
  error: ApiErrorValues,
): ApiResponse<null> => {
  return {
    success: false,
    message,
    error,
  };
};
