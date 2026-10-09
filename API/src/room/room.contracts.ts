import { IBaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { ParticipantDto, ParticipantEntity } from './entity/participant.entity';
import { RoomDto, RoomEntity } from './entity/room.entity';
import { FindOneOptions } from 'typeorm';

export interface ParticipantReader {
  findParticipantById(id: string): Promise<ParticipantEntity | null>;
}

export interface ParticipantWriter {
  createParticipant(
    participant: Omit<ParticipantDto, keyof IBaseAppEntity>,
  ): Promise<ParticipantEntity>;

  setParticipantLastAccessIp(
    participantId: string,
    lastAccessIp: string,
  ): Promise<void>;
}

export interface RoomReader {
  findRoomById(
    id: string,
    options?: FindOneOptions<RoomEntity>,
  ): Promise<RoomEntity | null>;
  getLoadedRoom(roomId: string): Promise<RoomDto | null>;
}

export interface RoomWriter {
  createRoom(room: Omit<RoomDto, keyof IBaseAppEntity>): Promise<RoomEntity>;
}

export interface RoomManager {
  checkIfRoomIsLoaded(roomId: string): Promise<boolean>;
  loadRoomToDatastore(roomId: string): Promise<void>;
  checkParticipantHasJoinedRoom(
    roomId: string,
    participantId: string,
  ): Promise<boolean>;
  joinParticipantToRoom(roomId: string, participantId: string): Promise<void>;
}

export const PARTICIPANT_READER = Symbol('PARTICIPANT_READER');
export const PARTICIPANT_WRITER = Symbol('PARTICIPANT_WRITER');
export const ROOM_READER = Symbol('ROOM_READER');
export const ROOM_WRITER = Symbol('ROOM_WRITER');
export const ROOM_MANAGER = Symbol('ROOM_MANAGER');
