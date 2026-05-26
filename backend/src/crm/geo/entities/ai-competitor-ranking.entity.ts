import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { AiCompetitor } from './ai-competitor.entity';
import { AiPlatform } from './ai-platform.entity';
import { AiQuery } from './ai-query.entity';

@Entity('ai_competitor_rankings', { schema: 'crm' })
export class AiCompetitorRanking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid' })
  competitor_id: string;

  @ManyToOne(() => AiCompetitor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'competitor_id' })
  competitor: AiCompetitor;

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

  @Column({ type: 'integer', nullable: true })
  ranking_position: number | null;

  @Column({ type: 'integer', default: 0 })
  mention_count: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  visibility_share: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  checked_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
