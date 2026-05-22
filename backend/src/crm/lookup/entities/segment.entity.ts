import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('segments', { schema: 'crm' })
export class Segment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;
}
