import { BaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { RoomEntity } from './room.entity';

/**
 * A picture placed on a board. The file itself is kept here; the board
 * element that shows it only carries this row's id (its `imageId` field).
 */
@Entity('board-images')
export class BoardImageEntity extends BaseAppEntity {
  // COLUMNS

  @Column({ type: 'uuid' })
  roomId: string;

  /** Who uploaded it. */
  @Column({ type: 'uuid' })
  participantId: string;

  /** Read from the file's contents, not the type the upload claimed. */
  @Column({ type: 'text' })
  mimeType: string;

  @Column({ type: 'bytea' })
  data: Buffer;

  // RELATIONS

  @ManyToOne(() => RoomEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: RoomEntity;
}
