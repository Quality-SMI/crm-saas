import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'client_scores', schema: 'crm' })
@Index(['client_id', 'calculated_at'])
export class ClientScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score_access: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score_clicks: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score_positioning: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  score_indexation: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  calculated_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
