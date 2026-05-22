import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('company_sizes', { schema: 'crm' })
export class CompanySize {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;
}
