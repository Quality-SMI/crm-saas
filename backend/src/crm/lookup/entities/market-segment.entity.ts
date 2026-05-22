import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('market_segments', { schema: 'crm' })
export class MarketSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;
}
