export type ServerErrorValues = 'ERR_UNABLE_TO_CONNECT_DB';

export type ValidationErrorValues = 'ERR_VALIDATION_FAILED';

export type ApiControllerErrorValues =
  'ERR_RESOURCE_NOT_FOUND' | 'ERR_ROOM_NOT_FOUND';

export type AuthApiErrorValues =
  | 'ERR_REFRESH_TOKEN_NOT_FOUND'
  | 'ERR_AUTHENTICATION_REQUIRED'
  | 'ERR_INVALID_CREDENTIALS'
  | 'ERR_MALFORMED_CREDENTIALS'
  | 'ERR_USER_NOT_FOUND'
  | 'ERR_PARTICIPANT_NOT_FOUND'
  | 'ERR_USER_ALREADY_EXISTS'
  | 'ERR_INVALID_PASSWORD'
  | 'ERR_SESSION_EXPIRED_OR_INVALID';

export type ApiErrorValues =
  | ServerErrorValues
  | ValidationErrorValues
  | ApiControllerErrorValues
  | AuthApiErrorValues
  | 'ERR_UNKNOWN';
