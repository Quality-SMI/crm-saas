import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'email_campaign_recipients', schema: 'crm' })
export class EmailCampaignRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  campaign_id: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ type: 'text', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 20, default: 'client' })
  recipient_type: string;

  @Column({ type: 'uuid', nullable: true })
  recipient_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  opened_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  clicked_at: Date | null;

  @Column({ type: 'text', nullable: true })
  bounce_reason: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resend_message_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
