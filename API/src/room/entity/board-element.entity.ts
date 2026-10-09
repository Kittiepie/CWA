import { BaseAppEntity, IBaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { RoomEntity } from './room.entity';

export type BoardElementDto = IBaseAppEntity & {
  roomId: string;
  type: string;
  data: object | null;
  deleted: boolean;
};

@Entity('board-elements')
export class BoardElementEntity extends BaseAppEntity {
  // COLUMNS

  @Column({ type: 'uuid' })
  roomId: string;

  @Column({ enum: ['temp'] })
  type: string;

  @Column({ type: 'jsonb' })
  data: object | null;

  @Column({ default: false })
  deleted: boolean;

  // RELATIONS

  @ManyToOne(() => RoomEntity, (room) => room.boardElements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roomId' })
  room: RoomEntity;

  // UTILS

  toDto(): BoardElementDto {
    return {
      id: this.id,
      roomId: this.roomId,
      type: this.type,
      data: this.data,
      deleted: this.deleted,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
