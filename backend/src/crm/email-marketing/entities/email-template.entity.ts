import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'email_templates', schema: 'crm' })
export class EmailTemplate {
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

  @Column({ type: 'varchar', length: 100, default: 'custom' })
  category: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;
}
