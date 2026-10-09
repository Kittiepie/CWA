import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ParticipantReader,
  ParticipantWriter,
  RoomManager,
  RoomReader,
  RoomWriter,
} from './room.contracts';
import { ParticipantDto, ParticipantEntity } from './entity/participant.entity';
import { IBaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { FindOneOptions, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomDto, RoomEntity } from './entity/room.entity';
import { BoardElementEntity } from './entity/board-element.entity';
import { RedisService } from 'src/redis/redis.service';
import { ApiError } from 'src/common/lib/errors/ApiError';
import { ParticipantMetadata } from 'src/common/lib/types/dto/ParticipantMetadata';
import { AllParticipantThemeColors } from 'src/common/lib/types/dto/ParticipantThemeColors';
import { elementsToHashFields } from './board-element.codec';
import {
  ACTIVE_ROOMS_SET_KEY,
  boardHashKey,
  roomKey,
  roomLastFlushedAtKey,
  roomParticipantsKey,
} from './room-redis-keys';

@Injectable()
export class RoomService
  implements
  ParticipantReader,
  ParticipantWriter,
  RoomReader,
  RoomWriter,
  RoomManager {
  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(ParticipantEntity)
    private participantRepository: Repository<ParticipantEntity>,
    @InjectRepository(RoomEntity)
    private roomRepository: Repository<RoomEntity>,
    @InjectRepository(BoardElementEntity)
    private boardElementRepository: Repository<BoardElementEntity>,
  ) { }

  async findParticipantById(id: string): Promise<ParticipantEntity | null> {
    return await this.participantRepository.findOne({
      where: { id },
      relations: {
        user: true,
      },
    });
  }

  async createParticipant(
    participant: Omit<ParticipantDto, keyof IBaseAppEntity>,
  ): Promise<ParticipantEntity> {
    return await this.participantRepository.save({
      ...participant,
      id: undefined,
    });
  }

  async setParticipantLastAccessIp(
    participantId: string,
    lastAccessIp: string,
  ): Promise<void> {
    await this.participantRepository.update(
      { id: participantId },
      { lastAccessIp },
    );
  }

  async findRoomById(
    id: string,
    options?: FindOneOptions<RoomEntity>,
  ): Promise<RoomEntity | null> {
    return await this.roomRepository.findOne({ where: { id }, ...options });
  }

  async createRoom(
    room: Omit<RoomDto, keyof IBaseAppEntity>,
  ): Promise<RoomEntity> {
    return await this.roomRepository.save({
      ...room,
      id: undefined,
    });
  }

  async checkIfRoomIsLoaded(roomId: string): Promise<boolean> {
    return this.redisService.exists(roomKey(roomId));
  }

  async checkParticipantHasJoinedRoom(
    roomId: string,
    participantId: string,
  ): Promise<boolean> {
    return this.redisService.exists(
      roomParticipantsKey(roomId, participantId),
    );
  }

  async loadRoomToDatastore(roomId: string): Promise<void> {
    const room = await this.findRoomById(roomId, {
      relations: {
        boardElements: true,
      },
    });

    if (!room) {
      throw new ApiError(
        'Room not found',
        HttpStatus.NOT_FOUND,
        'ERR_ROOM_NOT_FOUND',
      );
    }

    await this.redisService.set(roomKey(roomId), room.toDto());

    const hashFields = elementsToHashFields(room.boardElements);
    if (Object.keys(hashFields).length > 0) {
      await this.redisService.hSet(boardHashKey(roomId), hashFields);
    }

    await this.redisService.sAdd(ACTIVE_ROOMS_SET_KEY, roomId);
    await this.redisService.set(roomLastFlushedAtKey(roomId), Date.now());
  }

  async joinParticipantToRoom(
    roomId: string,
    participantId: string,
  ): Promise<void> {
    const room = await this.findRoomById(roomId);

    if (!room) {
      throw new ApiError(
        'Room not found',
        HttpStatus.NOT_FOUND,
        'ERR_ROOM_NOT_FOUND',
      );
    }

    const participant = await this.findParticipantById(participantId);

    if (!participant) {
      throw new ApiError(
        'Participant not found',
        HttpStatus.NOT_FOUND,
        'ERR_PARTICIPANT_NOT_FOUND',
      );
    }

    const participantMetadata: ParticipantMetadata = {
      joinedAt: new Date().toISOString(),
      displayName:
        participant?.user?.name ?? participant?.guestName ?? 'Unknown User',
      // random color
      themeColor:
        AllParticipantThemeColors[
        Math.floor(Math.random() * AllParticipantThemeColors.length)
        ],
      cursorX: NaN,
      cursorY: NaN,
    };

    await this.redisService.hSet(
      roomParticipantsKey(roomId, participantId),
      participantMetadata,
    );
  }

  async getLoadedRoom(roomId: string): Promise<RoomDto | null> {
    return this.redisService.get<RoomDto>(roomKey(roomId));
  }
}
