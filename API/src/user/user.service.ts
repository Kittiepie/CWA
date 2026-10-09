import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiError } from 'src/common/lib/errors/ApiError';
import {
  comparePassword,
  hashPassword,
} from 'src/common/utils/password-hash-utils';
import { UserAuthenticator, UserReader, UserWriter } from './user.contracts';
import { UserDto, UserEntity } from './entity/user.entity';
import { IBaseAppEntity } from 'src/common/entity/BaseAppEntity';

@Injectable()
export class UserService implements UserReader, UserWriter, UserAuthenticator {
  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
  ) { }

  async loginWithEmail(email: string, password: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: {
        participant: true,
      },
    });

    if (!user) {
      throw new ApiError(
        'User not found',
        HttpStatus.NOT_FOUND,
        'ERR_USER_NOT_FOUND',
      );
    }

    const isPasswordCorrect = await comparePassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordCorrect) {
      throw new ApiError(
        'Incorrect password',
        HttpStatus.UNAUTHORIZED,
        'ERR_INVALID_PASSWORD',
      );
    }

    return user;
  }

  async createUser(
    user: Omit<UserDto, keyof IBaseAppEntity | 'passwordHash'>,
    password: string,
  ): Promise<UserEntity> {
    const userExists = await this.usersRepository.findOne({
      where: { email: user.email },
    });

    if (userExists) {
      throw new ApiError(
        'User already exists',
        HttpStatus.BAD_REQUEST,
        'ERR_USER_ALREADY_EXISTS',
      );
    }

    const hashedPassword = await hashPassword(password);

    return this.usersRepository.save({
      ...user,
      passwordHash: hashedPassword,
      id: undefined,
    });
  }

  async findById(userId: string): Promise<UserEntity | null> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return user;
  }
}
