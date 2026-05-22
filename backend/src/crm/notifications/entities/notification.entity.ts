import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications', { schema: 'crm' })
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'text' }) title: string;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @Column({ default: false }) is_read: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
