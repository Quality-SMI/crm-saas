import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../../iam/users/entities/user.entity';

@Entity('ai_queries', { schema: 'crm' })
export class AiQuery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'jsonb', default: [] })
  platform_ids: string[];

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
