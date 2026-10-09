import { BaseAppEntity, IBaseAppEntity } from 'src/common/entity/BaseAppEntity';
import { ParticipantEntity } from 'src/room/entity/participant.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

export type AuthSessionDto = IBaseAppEntity & {
  participantId: string;
  tokenHash: string;
  uuid: string;
  expiresAt: Date;
  revoked: boolean;
  deviceInfo: string | null;
};

@Entity('auth-sessions')
export class AuthSessionEntity extends BaseAppEntity {
  // COLUMNS

  @Column({ type: 'uuid' })
  participantId: string;

  @Column({ length: 255 })
  tokenHash: string;

  @Column({ type: 'uuid' })
  uuid: string;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @Column({ type: 'text', nullable: true })
  deviceInfo: string | null;

  // RELATIONS

  @ManyToOne(
    () => ParticipantEntity,
    (participant) => participant.authSessions,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'participantId' })
  participant: ParticipantEntity;

  // UTILS

  toDto(): AuthSessionDto {
    return {
      id: this.id,
      participantId: this.participantId,
      tokenHash: this.tokenHash,
      uuid: this.uuid,
      expiresAt: this.expiresAt,
      revoked: this.revoked,
      deviceInfo: this.deviceInfo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
