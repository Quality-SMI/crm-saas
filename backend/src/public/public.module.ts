import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../crm/api-keys/api-keys.module';
import { BlogModule } from '../crm/blog/blog.module';
import { PublicBlogController } from './public-blog.controller';

@Module({
  imports: [ApiKeysModule, BlogModule],
  controllers: [PublicBlogController],
})
export class PublicModule {}
