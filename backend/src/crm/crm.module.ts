import { Module } from '@nestjs/common';
import { ClientsModule } from './clients/clients.module';
import { LookupModule } from './lookup/lookup.module';
import { LeadsModule } from './leads/leads.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { GeoModule } from './geo/geo.module';
import { PositioningModule } from './positioning/positioning.module';
import { KeywordsModule } from './keywords/keywords.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { BlogModule } from './blog/blog.module';
import { ScoresModule } from './scores/scores.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmailMarketingModule } from './email-marketing/email-marketing.module';

@Module({
  imports: [
    ClientsModule,
    LookupModule,
    LeadsModule,
    AppointmentsModule,
    GeoModule,
    PositioningModule,
    KeywordsModule,
    ApiKeysModule,
    BlogModule,
    ScoresModule,
    NotificationsModule,
    EmailMarketingModule,
  ],
})
export class CrmModule {}
