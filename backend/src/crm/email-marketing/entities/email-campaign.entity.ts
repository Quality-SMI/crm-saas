import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'email_campaigns', schema: 'crm' })
export class EmailCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text', nullable: true })
  preview_text: string | null;

  @Column({ type: 'text' })
  html_body: string;

  @Column({ type: 'text', default: 'Quality SMI' })
  from_name: string;

  @Column({ type: 'text' })
  from_email: string;

  @Column({ type: 'text', nullable: true })
  reply_to: string | null;

  @Column({ type: 'varchar', length: 50, default: 'all_clients' })
  audience_type: string;

  @Column({ type: 'jsonb', default: {} })
  audience_filters: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'int', default: 0 })
  total_recipients: number;

  @Column({ type: 'int', default: 0 })
  sent_count: number;

  @Column({ type: 'int', default: 0 })
  open_count: number;

  @Column({ type: 'int', default: 0 })
  click_count: number;

  @Column({ type: 'int', default: 0 })
  bounce_count: number;

  @Column({ type: 'int', default: 0 })
  unsubscribe_count: number;

  @Column({ type: 'uuid', nullable: true })
  template_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
