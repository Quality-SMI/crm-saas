import {
  Column, CreateDateColumn, DeleteDateColumn, Entity,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

@Entity('client_api_keys', { schema: 'crm' })
export class ClientApiKey {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) client_id: string;

  @ManyToOne(() => Client, { nullable: false, eager: false })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'text' }) name: string;

  @Column({ type: 'text', unique: true }) key: string;

  @Column({ type: 'boolean', default: true }) is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;

  @DeleteDateColumn({ type: 'timestamptz' }) deleted_at: Date | null;
}
