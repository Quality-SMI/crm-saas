import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('hosting_types', { schema: 'crm' })
export class HostingType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;
}
