import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlogAuthor } from './blog-author.entity';
import { BlogCategory } from './blog-category.entity';
import { BlogTag } from './blog-tag.entity';

export enum ArticleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

@Entity('blog_articles', { schema: 'crm' })
export class BlogArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  client_id: string;

  @Column({ type: 'uuid', nullable: true })
  author_id: string | null;

  @ManyToOne(() => BlogAuthor, { nullable: true, eager: false })
  @JoinColumn({ name: 'author_id' })
  author: BlogAuthor | null;

  @Column({ type: 'uuid', nullable: true })
  category_id: string | null;

  @ManyToOne(() => BlogCategory, { nullable: true, eager: false })
  @JoinColumn({ name: 'category_id' })
  category: BlogCategory | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'jsonb', nullable: true })
  raw_content: object | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: ArticleStatus.DRAFT,
  })
  status: ArticleStatus;

  @Column({ type: 'timestamptz', nullable: true })
  date_published: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @ManyToMany(() => BlogTag, { eager: false })
  @JoinTable({
    name: 'blog_article_tags',
    schema: 'crm',
    joinColumn: { name: 'article_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags: BlogTag[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deleted_at: Date | null;
}
