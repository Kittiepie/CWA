import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BoardImageEntity } from './entity/board-image.entity';

export interface NewBoardImage {
  roomId: string;
  participantId: string;
  mimeType: string;
  data: Buffer;
}

@Injectable()
export class BoardImageService {
  constructor(
    @InjectRepository(BoardImageEntity)
    private readonly boardImageRepository: Repository<BoardImageEntity>,
  ) {}

  /** Stores an upload and returns its id, which the board element will carry. */
  async saveImage(image: NewBoardImage): Promise<string> {
    const saved = await this.boardImageRepository.save(
      this.boardImageRepository.create(image),
    );
    return saved.id;
  }

  async findImage(id: string): Promise<BoardImageEntity | null> {
    return this.boardImageRepository.findOne({ where: { id } });
  }
}
