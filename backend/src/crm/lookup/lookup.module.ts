import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Segment } from './entities/segment.entity';
import { ServiceType } from './entities/service-type.entity';
import { ServiceSubtype } from './entities/service-subtype.entity';
import { HostingType } from './entities/hosting-type.entity';
import { MarketSegment } from './entities/market-segment.entity';
import { BusinessModel } from './entities/business-model.entity';
import { CompanySize } from './entities/company-size.entity';
import { Tag } from './entities/tag.entity';
import { LookupController } from './lookup.controller';
import { LookupService } from './lookup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Segment,
      ServiceType,
      ServiceSubtype,
      HostingType,
      MarketSegment,
      BusinessModel,
      CompanySize,
      Tag,
    ]),
  ],
  controllers: [LookupController],
  providers: [LookupService],
  exports: [LookupService],
})
export class LookupModule {}
