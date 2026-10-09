import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from 'src/redis/redis.service';
import { RoomEntity } from './entity/room.entity';
import { BoardElementEntity } from './entity/board-element.entity';
import { reconstructElementsFromHash } from './board-element.codec';
import {
  ACTIVE_ROOMS_SET_KEY,
  boardHashKey,
  chatListKey,
  roomLastFlushedAtKey,
  roomParticipantsPattern,
  roomKey,
} from './room-redis-keys';

const BOARD_SYNC_TICK_MS = Number(process.env.BOARD_SYNC_TICK_MS ?? 30_000);
const BOARD_FLUSH_INTERVAL_MS = Number(
  process.env.BOARD_FLUSH_INTERVAL_MS ?? 5 * 60 * 1000,
);

/**
 * Flushes each active room's live Redis board state back to Postgres —
 * periodically (each room on its own ~5 minute cadence, tracked by its own
 * last-flushed timestamp so a cheap tick doesn't do real work for rooms that
 * aren't due) and immediately, one final time, when the last participant
 * leaves a room (signalled by HTTP3 over the "room:closed" Redis channel,
 * since only that process knows when a room's sessions empty out).
 */
@Injectable()
export class BoardSyncService implements OnModuleInit {
  private readonly logger = new Logger(BoardSyncService.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,
    @InjectRepository(BoardElementEntity)
    private readonly boardElementRepository: Repository<BoardElementEntity>,
  ) { }

  async onModuleInit(): Promise<void> {
    await this.redisService.subscribe('room:closed', (message) => {
      this.handleRoomClosed(message).catch((error) =>
        this.logger.error(`failed to handle room:closed: ${error}`),
      );
    });
  }

  private async handleRoomClosed(message: string): Promise<void> {
    const { roomId } = JSON.parse(message) as { roomId: string };
    await this.flushRoomToPostgres(roomId);
    await this.evictRoomFromRedis(roomId);
  }

  @Interval(BOARD_SYNC_TICK_MS)
  async handleTick(): Promise<void> {
    const roomIds = await this.redisService.sMembers(ACTIVE_ROOMS_SET_KEY);
    const now = Date.now();

    for (const roomId of roomIds) {
      const lastFlushedAt =
        (await this.redisService.get<number>(roomLastFlushedAtKey(roomId))) ??
        0;

      if (now - lastFlushedAt < BOARD_FLUSH_INTERVAL_MS) continue;

      try {
        await this.flushRoomToPostgres(roomId);
      } catch (error) {
        this.logger.error(`failed to flush room ${roomId}: ${error}`);
      }
    }
  }

  private async flushRoomToPostgres(roomId: string): Promise<void> {
    const hash = await this.redisService.hGetAll<Record<string, string>>(
      boardHashKey(roomId),
    );
    const elements = hash ? reconstructElementsFromHash(hash) : [];

    if (elements.length > 0) {
      await this.boardElementRepository.upsert(
        elements.map((element) => ({
          id: element.id,
          roomId,
          type: element.type,
          data: element.data,
          deleted: element.deleted,
        })),
        ['id'],
      );
    }

    await this.roomRepository.update({ id: roomId }, { lastActiveAt: new Date() });
    await this.redisService.set(roomLastFlushedAtKey(roomId), Date.now());
  }

  private async evictRoomFromRedis(roomId: string): Promise<void> {
    // `room:{roomId}` goes first because it's what checkIfRoomIsLoaded tests:
    // a participant joining mid-eviction then reloads cleanly from Postgres
    // (already up to date, we just flushed) instead of being handed a room
    // that looks loaded but whose board hash is about to be deleted.
    await this.redisService.del(roomKey(roomId));

    const participantKeys = await this.redisService.scanKeys(
      roomParticipantsPattern(roomId),
    );

    for (const participantKey of participantKeys) {
      await this.redisService.del(participantKey);
    }

    await this.redisService.del(boardHashKey(roomId));
    await this.redisService.del(chatListKey(roomId));
    await this.redisService.del(roomLastFlushedAtKey(roomId));
    await this.redisService.sRem(ACTIVE_ROOMS_SET_KEY, roomId);
  }
}
