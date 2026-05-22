import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogArticle } from './entities/blog-article.entity';
import { BlogAuthor } from './entities/blog-author.entity';
import { BlogCategory } from './entities/blog-category.entity';
import { BlogTag } from './entities/blog-tag.entity';
import { Client } from '../clients/entities/client.entity';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlogArticle, BlogAuthor, BlogCategory, BlogTag, Client]),
  ],
  controllers: [BlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
