import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { GeoRunnerService } from './geo-runner.service';
import { AiPlatform } from './entities/ai-platform.entity';
import { AiQuery } from './entities/ai-query.entity';
import { AiMention } from './entities/ai-mention.entity';
import { AiVisibilityScore } from './entities/ai-visibility-score.entity';
import { AiSource } from './entities/ai-source.entity';
import { AiCompetitor } from './entities/ai-competitor.entity';
import { AiCompetitorRanking } from './entities/ai-competitor-ranking.entity';
import { Client } from '../clients/entities/client.entity';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      AiPlatform,
      AiQuery,
      AiMention,
      AiVisibilityScore,
      AiSource,
      AiCompetitor,
      AiCompetitorRanking,
      Client,
    ]),
  ],
  controllers: [GeoController],
  providers: [GeoService, GeoRunnerService],
  exports: [GeoService, GeoRunnerService],
})
export class GeoModule {}
