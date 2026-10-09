import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/filters/api-error.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { UnknownExceptionFilter } from './common/filters/unknown-exception.filter';
import { ConfigService } from '@nestjs/config';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ApiError } from './common/lib/errors/ApiError';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        return new ApiError(
          `Validation failed for: ${errors.map((e) => e.property).join(', ')}`,
          HttpStatus.BAD_REQUEST,
          'ERR_VALIDATION_FAILED',
        );
      },
    }),
  );

  app.useGlobalFilters(new UnknownExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalFilters(new ApiErrorFilter());

  const configService = app.get(ConfigService);

  const clientUrls =
    configService.get<string>('CORS_ORIGINS')?.split(',') ?? [];

  app.enableCors({
    origin: clientUrls,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
