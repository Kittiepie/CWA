import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { type AuthenticatedRequest } from 'src/common/interfaces/authenticated-request.interface';
import { type ApiResponse } from 'src/common/lib/ApiResponse';
import { ApiError } from 'src/common/lib/errors/ApiError';
import { successResponse } from 'src/common/utils/api-response-utils';
import { RoomDto } from './entity/room.entity';
import { ROOM_MANAGER, ROOM_READER, ROOM_WRITER } from './room.contracts';
import type { RoomManager, RoomReader, RoomWriter } from './room.contracts';

@Controller('room')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(
    @Inject(ROOM_READER)
    private readonly roomReader: RoomReader,
    @Inject(ROOM_WRITER)
    private readonly roomWriter: RoomWriter,
    @Inject(ROOM_MANAGER)
    private readonly roomManager: RoomManager,
  ) { }

  @Post('new-room')
  async createRoom(
    // @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<RoomDto>> {
    const room = await this.roomWriter.createRoom({
      lastActiveAt: new Date(),
    });

    return successResponse('Room created successfully', room);
  }

  @Get(':roomId')
  async joinRoom(
    @Param('roomId') roomId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponse<RoomDto>> {
    const isRoomLoaded = await this.roomManager.checkIfRoomIsLoaded(roomId);

    if (!isRoomLoaded) {
      await this.roomManager.loadRoomToDatastore(roomId);
    }

    const hasParticipantJoined =
      await this.roomManager.checkParticipantHasJoinedRoom(
        roomId,
        req.participantId,
      );

    if (!hasParticipantJoined) {
      await this.roomManager.joinParticipantToRoom(roomId, req.participantId);
    }

    const room = await this.roomReader.getLoadedRoom(roomId);

    if (!room) {
      throw new ApiError(
        'Room is unavailable',
        HttpStatus.INTERNAL_SERVER_ERROR,
        'ERR_UNKNOWN',
      );
    }

    return successResponse('Room joined successfully', room);
  }
}
