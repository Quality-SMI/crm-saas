import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('client_phones', { schema: 'crm' })
export class ClientPhone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, (client) => client.phones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid' })
  client_id: string;

  @Column({ type: 'text' })
  phone: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  label: string | null;

  @Column({ default: false })
  is_primary: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
