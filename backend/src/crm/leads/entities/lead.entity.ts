import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../iam/users/entities/user.entity';
import { LeadStage } from '../enums/lead-stage.enum';
import { LeadOrigin } from '../enums/lead-origin.enum';
import { LeadInteraction } from './lead-interaction.entity';

@Entity('leads', { schema: 'crm' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  contact_name: string | null;

  @Column({ type: 'text', nullable: true })
  contact_email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contact_phone: string | null;

  @Column({ type: 'text', nullable: true })
  website: string | null;

  @Column({ type: 'enum', enum: LeadStage, default: LeadStage.NEW })
  stage: LeadStage;

  @Column({ type: 'enum', enum: LeadOrigin, nullable: true })
  origin: LeadOrigin | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  estimated_value: string | null;

  @Column({ type: 'text', nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  lost_reason: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @Column({ type: 'uuid', nullable: true })
  owner_id: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @Column({ type: 'text', nullable: true, unique: true })
  legacy_id: string | null;

  @OneToMany(() => LeadInteraction, (i) => i.lead, { cascade: true })
  interactions: LeadInteraction[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at: Date | null;
}
