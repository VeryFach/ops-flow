import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //Cookie parser — agar bisa membaca cookie dari request
  app.use(cookieParser());

  // set global prefix, but keep root health endpoint on '/
  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });

    // Global validation pipe — whitelist strips unknown properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Urban Sense API')
    .setDescription('Backend API for Urban Sense Service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
