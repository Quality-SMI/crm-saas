import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserva buffer bruto para verificação de assinatura de webhooks
  const app = await NestFactory.create(AppModule, { bodyParser: true, rawBody: true });

  // Atrás de NGINX — confia em X-Forwarded-* (req.ip vira o IP real do cliente)
  const httpAdapter = app.getHttpAdapter().getInstance();
  if (typeof httpAdapter?.set === 'function') {
    httpAdapter.set('trust proxy', 1);
  }

  // Security
  app.use(
    helmet({
      frameguard: { action: 'deny' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // CORS — origens, métodos e headers explícitos; credentials para enviar cookie HttpOnly
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Swagger (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Quality SMI CRM API')
      .setDescription('API do CRM Quality SMI')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend rodando na porta ${port} (prefix /api)`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Swagger em http://localhost:${port}/api/docs`);
  }
}
bootstrap();
