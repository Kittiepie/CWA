import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { USER_AUTHENTICATOR, USER_READER, USER_WRITER } from './user.contracts';
import { UserEntity } from './entity/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [
    UserService,
    {
      provide: USER_READER,
      useExisting: UserService,
    },
    {
      provide: USER_WRITER,
      useExisting: UserService,
    },
    {
      provide: USER_AUTHENTICATOR,
      useExisting: UserService,
    },
  ],
  exports: [USER_READER, USER_WRITER, USER_AUTHENTICATOR],
})
export class UserModule { }
