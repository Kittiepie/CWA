import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface IBaseAppEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class BaseAppEntity implements IBaseAppEntity {
  // COLUMNS

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // UTILS

  toDto(): IBaseAppEntity {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
