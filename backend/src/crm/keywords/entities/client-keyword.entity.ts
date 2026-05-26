import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KeywordCategory } from './keyword-category.entity';

@Entity('client_keywords', { schema: 'crm' })
export class ClientKeyword {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) client_id: string;
  @Column({ type: 'text' }) keyword: string;
  @Column({ type: 'text', nullable: true }) slug: string | null;
  @Column({ type: 'uuid', nullable: true }) category_id: string | null;
  @ManyToOne(() => KeywordCategory, { nullable: true, eager: false })
  @JoinColumn({ name: 'category_id' })
  category: KeywordCategory | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @CreateDateColumn() created_at: Date;
  @DeleteDateColumn() deleted_at: Date | null;
}
