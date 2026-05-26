import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import { AuditService } from './audit.service';

// Captura apenas mutations. GETs ficam fora para não inflar a tabela.
const TRACKED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// Caminhos que NÃO devem ser auditados (saúde, docs, refresh barulhento)
const SKIP_PATH_PREFIXES = ['/api/health', '/api/docs', '/api/auth/refresh'];

const shouldSkip = (req: Request) => {
  if (!TRACKED_METHODS.has(req.method)) return true;
  return SKIP_PATH_PREFIXES.some((p) => req.originalUrl?.startsWith(p));
};

const summarizeBody = (body: unknown): Record<string, unknown> | null => {
  if (!body || typeof body !== 'object') return null;
  const out: Record<string, unknown> = {};
  // Logamos apenas as keys (não os valores) — evita guardar PII/passwords no log
  for (const k of Object.keys(body)) {
    if (/password|token|secret|api_?key/i.test(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = '[present]';
    }
  }
  return out;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (shouldSkip(req)) return next.handle();

    const started = Date.now();
    const user = (req as any).user as
      | { id?: string; email?: string }
      | undefined;
    const meta = { body_keys: summarizeBody(req.body) };

    const finalize = (statusCode: number) => {
      this.audit.record({
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        method: req.method,
        path: req.originalUrl || req.url || '',
        status_code: statusCode,
        ip: req.ip ?? null,
        user_agent: (req.headers['user-agent'] as string) ?? null,
        meta,
        duration_ms: Date.now() - started,
      });
    };

    return next.handle().pipe(
      tap(() => finalize(res.statusCode ?? 200)),
      catchError((err) => {
        const status = (err?.status as number) ?? 500;
        finalize(status);
        return throwError(() => err);
      }),
    );
  }
}
