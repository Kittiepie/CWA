import { ApiErrorValues } from './errors/ApiErrorValues';

export type ApiResponse<T> =
  | { success: true; message: string; data: T }
  | { success: false; message: string; error: ApiErrorValues };
