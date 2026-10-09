import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnvs } from './common/config/env.validation';
import { UserModule } from './user/user.module';
import { RoomModule } from './room/room.module';
import { RedisModule } from './redis/redis.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvs,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'app',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'db',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    AuthModule,
    UserModule,
    RoomModule,
    AdminModule, // Module quản trị admin
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
