import { IBaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { UserDto, UserEntity } from './entity/user.entity';

export interface UserReader {
  findById(id: string): Promise<UserEntity | null>;
}

export interface UserWriter {
  createUser(
    user: Omit<UserDto, keyof IBaseAppEntity | 'passwordHash'>,
    password: string,
  ): Promise<UserEntity>;
}

export interface UserAuthenticator {
  loginWithEmail(email: string, password: string): Promise<UserEntity>;
}

export const USER_READER = Symbol('USER_READER');
export const USER_WRITER = Symbol('USER_WRITER');
export const USER_AUTHENTICATOR = Symbol('USER_AUTHENTICATOR');
