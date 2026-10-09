import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserEntity } from 'src/user/entity/user.entity';
import { RoomEntity } from 'src/room/entity/room.entity';
import { ParticipantEntity } from 'src/room/entity/participant.entity';
import { ADMIN_LIST_READER, ADMIN_STATS_READER } from './admin.contracts';

/**
 * AdminModule chứa tất cả logic nghiệp vụ của khu vực quản trị.
 *
 * Import trực tiếp các entity cần thiết vì AdminModule không phụ thuộc
 * vào UserModule hay RoomModule (tránh circular dependency và tăng tính độc lập).
 */
@Module({
  imports: [
    // Đăng ký các entity cần truy vấn trong AdminService
    TypeOrmModule.forFeature([UserEntity, RoomEntity, ParticipantEntity]),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,

    // Bind AdminService vào các token contract (theo pattern của dự án)
    {
      provide: ADMIN_STATS_READER,
      useExisting: AdminService,
    },
    {
      provide: ADMIN_LIST_READER,
      useExisting: AdminService,
    },
  ],
})
export class AdminModule {}
