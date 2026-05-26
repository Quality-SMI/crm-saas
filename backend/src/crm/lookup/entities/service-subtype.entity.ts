import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ServiceType } from './service-type.entity';

@Entity('service_subtypes', { schema: 'crm' })
export class ServiceSubtype {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @ManyToOne(() => ServiceType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_type_id' })
  service_type: ServiceType;

  @Column({ type: 'uuid' })
  service_type_id: string;
}
