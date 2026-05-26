import * as crypto from 'crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { EmailSendingService } from './email-sending.service';
import { EmailMarketingService } from './email-marketing.service';

/**
 * Verifica assinatura Standard Webhooks (Resend usa este formato via svix).
 * Spec: https://www.standardwebhooks.com/
 */
function verifyResendSignature(
  rawBody: Buffer,
  msgId: string | undefined,
  timestamp: string | undefined,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!msgId || !timestamp || !signature) return false;

  // Rejeita timestamps fora de ±5 minutos (previne replay attacks)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300)
    return false;

  const toSign = `${msgId}.${timestamp}.${rawBody.toString('utf8')}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign)
    .digest('base64');

  // Signature pode ter múltiplos valores separados por espaço: "v1,<sig1> v1,<sig2>"
  return signature.split(' ').some((s) => {
    const sig = s.replace(/^v1,/, '');
    try {
      const a = Buffer.from(sig, 'base64');
      const b = Buffer.from(expected, 'base64');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

@ApiTags('email-marketing-webhooks')
@Controller('email-marketing/webhooks')
export class EmailMarketingWebhookController {
  private readonly logger = new Logger(EmailMarketingWebhookController.name);

  constructor(
    private readonly emailSendingService: EmailSendingService,
    private readonly emailMarketingService: EmailMarketingService,
    private readonly config: ConfigService,
  ) {}

  // 1x1 transparent GIF
  private static readonly TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );

  @Get('track/:recipientId')
  async trackOpen(
    @Param('recipientId') recipientId: string,
    @Res() res: Response,
  ): Promise<void> {
    this.emailSendingService.trackOpen(recipientId).catch(() => {});
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': String(
        EmailMarketingWebhookController.TRACKING_PIXEL.length,
      ),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    });
    res.end(EmailMarketingWebhookController.TRACKING_PIXEL);
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async handleResendWebhook(
    @Req() req: { rawBody?: Buffer },
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');

    if (secret) {
      const rawBody = req.rawBody;
      if (
        !rawBody ||
        !verifyResendSignature(
          rawBody,
          svixId,
          svixTimestamp,
          svixSignature,
          secret,
        )
      ) {
        this.logger.warn('WEBHOOK_RESEND_INVALID_SIGNATURE');
        throw new UnauthorizedException('Assinatura de webhook inválida');
      }
    } else {
      this.logger.warn(
        'RESEND_WEBHOOK_SECRET não configurado — verificação de assinatura desativada',
      );
    }

    this.emailSendingService.processWebhook(payload).catch((err: Error) => {
      this.logger.error(`Erro ao processar webhook Resend: ${err.message}`);
    });
    return { ok: true };
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async handleUnsubscribe(
    @Headers('x-webhook-secret') incomingSecret: string,
    @Body() body: { email: string; reason?: string },
  ): Promise<{ ok: boolean }> {
    const expected = this.config.get<string>('WEBHOOK_UNSUBSCRIBE_SECRET');

    if (expected) {
      if (!incomingSecret) {
        throw new UnauthorizedException('Header x-webhook-secret ausente');
      }
      // timingSafeEqual previne timing attacks na comparação de segredos
      const a = Buffer.from(incomingSecret);
      const b = Buffer.from(expected);
      const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!valid) {
        this.logger.warn('WEBHOOK_UNSUBSCRIBE_INVALID_SECRET');
        throw new UnauthorizedException('Segredo de webhook inválido');
      }
    } else {
      this.logger.warn(
        'WEBHOOK_UNSUBSCRIBE_SECRET não configurado — endpoint desprotegido',
      );
    }

    if (body?.email) {
      await this.emailMarketingService.addUnsubscribe(body.email, body.reason);
    }
    return { ok: true };
  }
}
