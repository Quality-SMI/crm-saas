import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('business_models', { schema: 'crm' })
export class BusinessModel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;
}
