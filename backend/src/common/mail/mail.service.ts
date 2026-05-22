import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Mail service minimalista. Usa SendGrid HTTP API se SENDGRID_API_KEY estiver definido,
 * caso contrário loga o conteúdo (modo dev / fallback). Não bloqueia o request em falhas.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: SendMailInput): Promise<void> {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    const from = this.config.get<string>('SENDGRID_FROM_EMAIL');
    const fromName = this.config.get<string>('SENDGRID_FROM_NAME') || 'Quality SMI';

    if (!apiKey || !from) {
      // Fallback dev — apenas loga
      this.logger.log(
        `[MAIL FALLBACK] to=${input.to} subject="${input.subject}"\n${input.text}`,
      );
      return;
    }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: input.to }] }],
          from: { email: from, name: fromName },
          subject: input.subject,
          content: [
            { type: 'text/plain', value: input.text },
            ...(input.html ? [{ type: 'text/html', value: input.html }] : []),
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`SendGrid HTTP ${res.status}: ${body}`);
      }
    } catch (err) {
      this.logger.error(`Mail send failed: ${(err as Error).message}`);
    }
  }
}
