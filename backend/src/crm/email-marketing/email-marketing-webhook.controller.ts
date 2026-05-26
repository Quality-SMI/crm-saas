import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmailSendingService } from './email-sending.service';
import { EmailMarketingService } from './email-marketing.service';

@ApiTags('email-marketing-webhooks')
@Controller('email-marketing/webhooks')
export class EmailMarketingWebhookController {
  private readonly logger = new Logger(EmailMarketingWebhookController.name);

  constructor(
    private readonly emailSendingService: EmailSendingService,
    private readonly emailMarketingService: EmailMarketingService,
  ) {}

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async handleResendWebhook(@Body() payload: any): Promise<{ ok: boolean }> {
    this.emailSendingService.processWebhook(payload).catch((err: Error) => {
      this.logger.error(`Erro ao processar webhook Resend: ${err.message}`);
    });
    return { ok: true };
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async handleUnsubscribe(
    @Body() body: { email: string; reason?: string },
  ): Promise<{ ok: boolean }> {
    if (body?.email) {
      await this.emailMarketingService.addUnsubscribe(body.email, body.reason);
    }
    return { ok: true };
  }
}
