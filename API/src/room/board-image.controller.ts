import {
  Controller,
  FileTypeValidator,
  Get,
  HttpStatus,
  Inject,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { type AuthenticatedRequest } from 'src/common/interfaces/authenticated-request.interface';
import { type ApiResponse } from 'src/common/lib/ApiResponse';
import { ApiError } from 'src/common/lib/errors/ApiError';
import { successResponse } from 'src/common/utils/api-response-utils';
import { BoardImageService } from './board-image.service';
import { ROOM_MANAGER, type RoomManager } from './room.contracts';

/** Largest image a board takes. The web app checks the same limit before uploading. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Formats Next's image optimiser can resize (it refuses SVG by default). */
const IMAGE_TYPES = /^image\/(png|jpeg|gif|webp)$/;

/** The part of Multer's uploaded-file object this controller reads. */
interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

/**
 * Board images: uploaded by people in a room, then served to anyone holding
 * the id. Serving is deliberately open: the web app's image optimiser fetches
 * these server-side, with no user token, and ids are random UUIDs.
 */
@Controller()
export class BoardImageController {
  constructor(
    private readonly boardImages: BoardImageService,
    @Inject(ROOM_MANAGER)
    private readonly roomManager: RoomManager,
  ) {}

  @Post('room/:roomId/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  async uploadImage(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        // Checks the file's actual bytes, and keeps the type they show
        // rather than whatever the browser claimed.
        validators: [
          new FileTypeValidator({
            fileType: IMAGE_TYPES,
            overrideMimeType: true,
          }),
        ],
      }),
    )
    file: UploadedImage,
  ): Promise<ApiResponse<{ id: string }>> {
    const inRoom = await this.roomManager.checkParticipantHasJoinedRoom(
      roomId,
      req.participantId,
    );
    if (!inRoom) {
      throw new ApiError(
        'Join the room before adding images to it',
        HttpStatus.FORBIDDEN,
        'ERR_FORBIDDEN',
      );
    }

    const id = await this.boardImages.saveImage({
      roomId,
      participantId: req.participantId,
      mimeType: file.mimetype,
      data: file.buffer,
    });
    return successResponse('Image uploaded', { id });
  }

  @Get('board-images/:imageId')
  async getImage(
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const image = await this.boardImages.findImage(imageId);
    if (!image) {
      throw new ApiError(
        'Image not found',
        HttpStatus.NOT_FOUND,
        'ERR_RESOURCE_NOT_FOUND',
      );
    }
    // An id's file never changes, so anything may keep a copy for good. Set
    // here rather than with @Header, which would stamp error replies too.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(image.data, {
      type: image.mimeType,
      length: image.data.length,
    });
  }
}
