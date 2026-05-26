import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { AiPlatform } from './ai-platform.entity';
import { AiQuery } from './ai-query.entity';
import { User } from '../../../iam/users/entities/user.entity';

export type MentionType = 'DIRECT' | 'INDIRECT' | 'CITATION' | 'RECOMMENDATION';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

@Entity('ai_mentions', { schema: 'crm' })
export class AiMention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid' })
  platform_id: string;

  @ManyToOne(() => AiPlatform, { eager: false })
  @JoinColumn({ name: 'platform_id' })
  platform: AiPlatform;

  @Column({ type: 'uuid', nullable: true })
  query_id: string | null;

  @ManyToOne(() => AiQuery, { nullable: true, eager: false })
  @JoinColumn({ name: 'query_id' })
  query: AiQuery | null;

  @Column({ type: 'varchar', length: 50, default: 'DIRECT' })
  mention_type: MentionType;

  @Column({ type: 'text', nullable: true })
  response_excerpt: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  sentiment: Sentiment | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  sentiment_score: string | null;

  @Column({ type: 'integer', nullable: true })
  ranking_position: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  visibility_impact: string | null;

  @Column({ type: 'jsonb', default: [] })
  urls_cited: string[];

  @Column({ type: 'jsonb', nullable: true })
  geo_metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  checked_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
