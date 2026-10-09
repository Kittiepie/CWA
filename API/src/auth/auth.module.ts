import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AUTH_SESSION_VALIDATOR } from './auth.contracts';
import { AuthSessionEntity } from './entity/auth-session.entity';
import { RoomModule } from 'src/room/room.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AuthSessionEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      global: true,
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.getOrThrow<string>('JWT_SECRET'),
          // Should expiresIn is not set when using sign or signAsync, it will default to 0ms
          signOptions: { expiresIn: 0 },
        };
      },
    }),
    UserModule,
    RoomModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: AUTH_SESSION_VALIDATOR,
      useExisting: AuthService,
    },
  ],
})
export class AuthModule { }
