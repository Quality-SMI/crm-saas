import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendMailInput): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from =
      this.config.get<string>('RESEND_FROM_EMAIL') ||
      'noreply@marketing.qualitysmi.com.br';
    const fromName =
      this.config.get<string>('RESEND_FROM_NAME') || 'Quality SMI';

    if (!apiKey) {
      this.logger.log(
        `[MAIL FALLBACK] to=${input.to} subject="${input.subject}"\n${input.text}`,
      );
      return;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${from}>`,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Resend HTTP ${res.status}: ${body}`);
      }
    } catch (err) {
      this.logger.error(`Mail send failed: ${(err as Error).message}`);
    }
  }
}
