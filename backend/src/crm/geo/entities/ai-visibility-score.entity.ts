import {
  Column, CreateDateColumn, Entity,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { AiPlatform } from './ai-platform.entity';

@Entity('ai_visibility_scores', { schema: 'crm' })
export class AiVisibilityScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid', nullable: true })
  platform_id: string | null;

  @ManyToOne(() => AiPlatform, { nullable: true, eager: false })
  @JoinColumn({ name: 'platform_id' })
  platform: AiPlatform | null;

  @Column({ type: 'date' })
  score_date: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  visibility_score: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  geo_score: string | null;

  @Column({ type: 'integer', default: 0 })
  mention_count: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  avg_ranking: string | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  avg_sentiment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
