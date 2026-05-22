import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_permissions', { schema: 'iam' })
export class UserPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 100 })
  permission: string;

  @Column({ type: 'boolean' })
  granted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
