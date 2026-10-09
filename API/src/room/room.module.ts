import { Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { BoardSyncService } from './board-sync.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipantEntity } from './entity/participant.entity';
import {
  PARTICIPANT_READER,
  PARTICIPANT_WRITER,
  ROOM_MANAGER,
  ROOM_READER,
  ROOM_WRITER,
} from './room.contracts';
import { RedisModule } from 'src/redis/redis.module';
import { RoomEntity } from './entity/room.entity';
import { BoardElementEntity } from './entity/board-element.entity';
import { ChatMessageEntity } from './entity/chat-message.entity';
import { BoardImageEntity } from './entity/board-image.entity';
import { BoardImageController } from './board-image.controller';
import { BoardImageService } from './board-image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParticipantEntity,
      RoomEntity,
      BoardElementEntity,
      ChatMessageEntity,
      BoardImageEntity,
    ]),
    RedisModule,
  ],
  controllers: [RoomController, BoardImageController],
  providers: [
    RoomService,
    BoardSyncService,
    BoardImageService,
    {
      provide: PARTICIPANT_READER,
      useExisting: RoomService,
    },
    {
      provide: PARTICIPANT_WRITER,
      useExisting: RoomService,
    },
    {
      provide: ROOM_READER,
      useExisting: RoomService,
    },
    {
      provide: ROOM_WRITER,
      useExisting: RoomService,
    },
    {
      provide: ROOM_MANAGER,
      useExisting: RoomService,
    },
  ],
  exports: [PARTICIPANT_READER, PARTICIPANT_WRITER],
})
export class RoomModule { }
