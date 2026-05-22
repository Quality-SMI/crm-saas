import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tags', { schema: 'crm' })
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;
}
