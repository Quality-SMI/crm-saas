import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

@Entity({ name: 'gsc_snapshots', schema: 'crm' })
@Index(['client_id', 'date'])
export class GscSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 90 })
  period_days: number;

  @Column({ type: 'int', default: 0 })
  total_clicks: number;

  @Column({ type: 'int', default: 0 })
  total_impressions: number;

  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  avg_position: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 4, nullable: true })
  avg_ctr: number | null;

  @Column({ type: 'jsonb', default: [] })
  keywords: Array<{
    query: string;
    clicks: number;
    impressions: number;
    position: number;
    ctr: number;
  }>;

  @Column({ type: 'jsonb', default: [] })
  pages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    position: number;
  }>;

  @Column({ type: 'int', default: 0 })
  sessions: number;

  @Column({ type: 'int', default: 0 })
  users: number;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  synced_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
