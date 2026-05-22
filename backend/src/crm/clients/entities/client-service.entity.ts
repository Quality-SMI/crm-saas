import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { ServiceType } from '../../lookup/entities/service-type.entity';

export type ClientServiceStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

@Entity('client_services', { schema: 'crm' })
export class ClientService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, (c) => c.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid' })
  service_type_id: string;

  @ManyToOne(() => ServiceType, { eager: false, nullable: false })
  @JoinColumn({ name: 'service_type_id' })
  service_type: ServiceType;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: ClientServiceStatus;

  @Column({ type: 'integer', nullable: true })
  contract_months: number | null;

  /** Agency management fee (Ads services) */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  management_fee: string | null;

  /** Client's media/ad budget (Ads services) */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  media_budget: string | null;

  /** Recurring monthly value (SEO, PR, etc.) */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  monthly_value: string | null;

  /** One-time project value (Website, etc.) */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  one_time_value: string | null;

  @Column({ type: 'integer', default: 0 })
  renewal_count: number;

  @Column({ type: 'date', nullable: true })
  started_at: string | null;

  /** Service-specific extras: keywords_qty, contracted_pages, monthly_articles, etc. */
  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
