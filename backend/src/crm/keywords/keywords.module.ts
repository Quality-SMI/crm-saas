import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientKeyword } from './entities/client-keyword.entity';
import { KeywordCategory } from './entities/keyword-category.entity';
import { KeywordsController } from './keywords.controller';
import { KeywordsService } from './keywords.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientKeyword, KeywordCategory])],
  controllers: [KeywordsController],
  providers: [KeywordsService],
})
export class KeywordsModule {}
