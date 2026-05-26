import {
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  Column,
} from 'typeorm';
import { Client } from './client.entity';
import { Tag } from '../../lookup/entities/tag.entity';

@Entity('client_tags', { schema: 'crm' })
export class ClientTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @ManyToOne(() => Client, (c) => c.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ type: 'uuid' })
  tag_id: string;

  @ManyToOne(() => Tag, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: Tag;
}
