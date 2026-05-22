import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('password_reset_tokens', { schema: 'iam' })
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  user_id!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index({ unique: true })
  token_hash!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  used_at!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  requested_ip!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
