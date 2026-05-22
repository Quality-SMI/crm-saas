import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('keyword_categories', { schema: 'crm' })
export class KeywordCategory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) client_id: string | null;
  @Column({ type: 'text' }) name: string;
  @CreateDateColumn() created_at: Date;
  @DeleteDateColumn() deleted_at: Date | null;
}
