import { BaseAppEntity, IBaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { RoomEntity } from './room.entity';
import { ParticipantEntity } from './participant.entity';

export type ChatMessageDto = IBaseAppEntity & {
  roomId: string;
  participantId: string;
  content: string;
  coordinates: object | null;
};

@Entity('chat-messages')
export class ChatMessageEntity extends BaseAppEntity {
  // COLUMNS

  @Column({ type: 'uuid' })
  roomId: string;

  @Column({ type: 'uuid' })
  participantId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb' })
  coordinates: object | null;

  // RELATIONS

  @ManyToOne(() => RoomEntity, (room) => room.chatMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roomId' })
  room: RoomEntity;

  @ManyToOne(
    () => ParticipantEntity,
    (participant) => participant.chatMessages,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'participantId' })
  participant: ParticipantEntity;

  // UTILS

  toDto(): ChatMessageDto {
    return {
      id: this.id,
      roomId: this.roomId,
      participantId: this.participantId,
      content: this.content,
      coordinates: this.coordinates,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
