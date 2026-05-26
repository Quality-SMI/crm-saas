import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

@Entity('ai_sources', { schema: 'crm' })
export class AiSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ length: 255 })
  domain: string;

  @Column({ type: 'integer', default: 0 })
  citation_count: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  authority_score: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
