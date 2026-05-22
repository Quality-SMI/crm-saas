import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'audit_log', schema: 'iam' })
@Index(['user_id', 'created_at'])
@Index(['method', 'path'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  user_email!: string | null;

  @Column({ type: 'varchar', length: 10 })
  method!: string;

  @Column({ type: 'text' })
  path!: string;

  @Column({ type: 'int' })
  status_code!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  duration_ms!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
