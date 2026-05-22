import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('service_types', { schema: 'crm' })
export class ServiceType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true, unique: true })
  code: string | null;

  @Column({ type: 'int', default: 99 })
  sort_order: number;
}
