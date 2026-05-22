import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from './entities/lead.entity';
import { LeadInteraction } from './entities/lead-interaction.entity';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, LeadInteraction])],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
