import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { Session } from '../../sessions/entities/session.entity';

@Entity('users', { schema: 'iam' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ select: false })
  password_hash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.SALES })
  role: UserRole;

  @Column({ default: true })
  is_active: boolean;

  // null = usuário interno | uuid = cliente vinculado (portal do cliente)
  @Column({ type: 'uuid', nullable: true })
  client_id: string | null;

  @Column({ default: 0 })
  failed_login_attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  locked_until: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date | null;

  @Column({ type: 'text', nullable: true })
  avatar_url: string | null;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at: Date | null;

  get isLocked(): boolean {
    return this.locked_until != null && this.locked_until > new Date();
  }

  get isClientPortal(): boolean {
    return this.role === UserRole.CLIENT_PORTAL;
  }
}
