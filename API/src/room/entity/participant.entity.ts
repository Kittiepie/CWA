import { BaseAppEntity, IBaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { ChatMessageEntity } from './chat-message.entity';
import { UserEntity } from 'src/user/entity/user.entity';
import { AuthSessionEntity } from 'src/auth/entity/auth-session.entity';

export type ParticipantDto = IBaseAppEntity & {
  userId: string | null;
  guestName: string;
  lastAccessIp: string | null;
};

@Entity('participants')
export class ParticipantEntity extends BaseAppEntity {
  // COLUMNS

  @Column({ type: 'uuid', nullable: true, unique: true })
  userId: string | null;

  @Column({ type: 'text' })
  guestName: string;

  @Column({ type: 'inet', nullable: true })
  lastAccessIp: string | null;

  // RELATIONS

  @OneToMany(() => AuthSessionEntity, (authSession) => authSession.participant)
  authSessions: AuthSessionEntity[];

  @OneToOne(() => UserEntity, (user) => user.participant, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity | null;

  @OneToMany(() => ChatMessageEntity, (chatMessage) => chatMessage.room)
  chatMessages: ChatMessageEntity[];

  // UTILS

  toDto(): ParticipantDto {
    return {
      id: this.id,
      userId: this.userId,
      guestName: this.guestName,
      lastAccessIp: this.lastAccessIp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
