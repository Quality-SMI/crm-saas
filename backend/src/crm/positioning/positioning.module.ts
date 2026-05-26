import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GscSnapshot } from './entities/gsc-snapshot.entity';
import { Client } from '../clients/entities/client.entity';
import { PositioningService } from './positioning.service';
import { PositioningController } from './positioning.controller';
import { PositioningReportService } from './positioning-report.service';

@Module({
  imports: [TypeOrmModule.forFeature([GscSnapshot, Client])],
  providers: [PositioningService, PositioningReportService],
  controllers: [PositioningController],
  exports: [PositioningService, PositioningReportService],
})
export class PositioningModule {}
