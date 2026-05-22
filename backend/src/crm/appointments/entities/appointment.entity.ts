import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../iam/users/entities/user.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { AppointmentStatus } from '../enums/appointment-status.enum';

@Entity('lead_appointments', { schema: 'crm' })
export class LeadAppointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  lead_id: string;

  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead: Lead;

  @Column({ type: 'timestamptz' })
  scheduled_at: Date;

  @Column({ type: 'uuid', nullable: true })
  scheduled_by_id: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'scheduled_by_id' })
  scheduled_by: User | null;

  @Column({ type: 'uuid', nullable: true })
  assigned_to_id: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'assigned_to_id' })
  assigned_to: User | null;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'integer', nullable: true, default: 60 })
  duration_minutes: number | null;

  @Column({ type: 'text', nullable: true })
  meet_link: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
