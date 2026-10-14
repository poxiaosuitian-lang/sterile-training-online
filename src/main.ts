import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  if (config.get('NODE_ENV') === 'production') {
    const secret = config.get<string>('JWT_SECRET', '');
    const password = config.get<string>('ADMIN_PASSWORD', '');
    if (secret.length < 32 || password.length < 12 ||
      /replace_with|development/i.test(secret + password)) {
      throw new Error('请配置独立的 JWT_SECRET（至少32位）及 ADMIN_PASSWORD（至少12位）');
    }
  }
  if (config.get('TRUST_PROXY') === '1') app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const origins = config.get<string>('CORS_ORIGINS', '*');

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: origins === '*' ? true : origins.split(',').map((item) => item.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('无菌操作训练 API')
    .setDescription('Flutter 五关无菌操作训练应用后端接口')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

void bootstrap();
