import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../iam/users/entities/user.entity';
import { Segment } from '../../lookup/entities/segment.entity';
import { ServiceType } from '../../lookup/entities/service-type.entity';
import { ServiceSubtype } from '../../lookup/entities/service-subtype.entity';
import { HostingType } from '../../lookup/entities/hosting-type.entity';
import { MarketSegment } from '../../lookup/entities/market-segment.entity';
import { BusinessModel } from '../../lookup/entities/business-model.entity';
import { CompanySize } from '../../lookup/entities/company-size.entity';
import { ClientTag } from './client-tag.entity';
import { ClientEmail } from './client-email.entity';
import { ClientPhone } from './client-phone.entity';
import { ClientService } from './client-service.entity';
import { ClientStatus } from '../enums/client-status.enum';
import { BillingType } from '../enums/billing-type.enum';

@Entity('clients', { schema: 'crm' })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  company_name: string;

  @Column({ type: 'text', nullable: true })
  legal_name: string | null;

  @Column({ type: 'text', nullable: true })
  cnpj: string | null;

  @Column({ type: 'text' })
  domain: string;

  @Column({ type: 'text', nullable: true })
  contact_name: string | null;

  @Column({ type: 'enum', enum: ClientStatus, default: ClientStatus.ACTIVE })
  status: ClientStatus;

  @ManyToOne(() => Segment, { nullable: true, eager: false })
  @JoinColumn({ name: 'segment_id' })
  segment: Segment | null;

  @Column({ type: 'uuid', nullable: true })
  segment_id: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'seller_id' })
  seller: User | null;

  @Column({ type: 'uuid', nullable: true })
  seller_id: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'technical_id' })
  technical: User | null;

  @Column({ type: 'uuid', nullable: true })
  technical_id: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'writer_id' })
  writer: User | null;

  @Column({ type: 'uuid', nullable: true })
  writer_id: string | null;

  @ManyToOne(() => ServiceType, { nullable: true, eager: false })
  @JoinColumn({ name: 'service_type_id' })
  service_type: ServiceType | null;

  @Column({ type: 'uuid', nullable: true })
  service_type_id: string | null;

  @ManyToOne(() => ServiceSubtype, { nullable: true, eager: false })
  @JoinColumn({ name: 'service_subtype_id' })
  service_subtype: ServiceSubtype | null;

  @Column({ type: 'uuid', nullable: true })
  service_subtype_id: string | null;

  @Column({ type: 'integer', nullable: true })
  contract_keywords_qty: number | null;

  @Column({ type: 'date', nullable: true })
  contracted_at: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  monthly_value: string | null;

  @Column({ type: 'enum', enum: BillingType, default: BillingType.MONTHLY, nullable: true })
  billing_type: BillingType | null;

  @Column({ type: 'date', nullable: true })
  first_payment_date: string | null;

  @Column({ type: 'smallint', nullable: true })
  due_day: number | null;

  @Column({ type: 'smallint', nullable: true })
  installments_qty: number | null;

  @ManyToOne(() => HostingType, { nullable: true, eager: false })
  @JoinColumn({ name: 'hosting_type_id' })
  hosting_type: HostingType | null;

  @Column({ type: 'uuid', nullable: true })
  hosting_type_id: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  zip_code: string | null;

  @Column({ type: 'text', nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  street_number: string | null;

  @Column({ type: 'text', nullable: true })
  neighborhood: string | null;

  @Column({ type: 'text', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  state: string | null;

  @Column({ type: 'text', array: true, default: [] })
  contracted_keywords: string[];

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  webhook_deploy: string | null;

  @Column({ type: 'text', nullable: true })
  clarity_project_id: string | null;

  @Column({ type: 'text', nullable: true })
  legacy_id: string | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by' })
  created_by_user: User | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToOne(() => MarketSegment, { nullable: true, eager: false })
  @JoinColumn({ name: 'market_segment_id' })
  market_segment: MarketSegment | null;

  @Column({ type: 'uuid', nullable: true })
  market_segment_id: string | null;

  @ManyToOne(() => BusinessModel, { nullable: true, eager: false })
  @JoinColumn({ name: 'business_model_id' })
  business_model: BusinessModel | null;

  @Column({ type: 'uuid', nullable: true })
  business_model_id: string | null;

  @ManyToOne(() => CompanySize, { nullable: true, eager: false })
  @JoinColumn({ name: 'company_size_id' })
  company_size: CompanySize | null;

  @Column({ type: 'uuid', nullable: true })
  company_size_id: string | null;

  @OneToMany(() => ClientEmail, (e) => e.client, { cascade: true })
  emails: ClientEmail[];

  @OneToMany(() => ClientPhone, (p) => p.client, { cascade: true })
  phones: ClientPhone[];

  @OneToMany(() => ClientTag, (ct) => ct.client, { cascade: true })
  tags: ClientTag[];

  @OneToMany(() => ClientService, (cs) => cs.client, { cascade: true })
  services: ClientService[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at: Date | null;
}
