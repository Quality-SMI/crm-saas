import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailCampaign } from './entities/email-campaign.entity';
import { EmailCampaignRecipient } from './entities/email-campaign-recipient.entity';
import { EmailUnsubscribe } from './entities/email-unsubscribe.entity';
import { EmailMarketingService } from './email-marketing.service';
import { EmailSendingService } from './email-sending.service';
import { EmailMarketingController } from './email-marketing.controller';
import { EmailMarketingWebhookController } from './email-marketing-webhook.controller';
import { SeoAnalysisService } from './seo-analysis.service';
import { SeoBlastService } from './seo-blast.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailTemplate,
      EmailCampaign,
      EmailCampaignRecipient,
      EmailUnsubscribe,
    ]),
  ],
  controllers: [EmailMarketingController, EmailMarketingWebhookController],
  providers: [EmailMarketingService, EmailSendingService, SeoAnalysisService, SeoBlastService],
  exports: [EmailMarketingService, EmailSendingService, SeoAnalysisService, SeoBlastService],
})
export class EmailMarketingModule {}
