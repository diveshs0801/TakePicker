import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import path from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*',
    exposedHeaders: [
      'Location',
      'Upload-Offset',
      'Upload-Length',
      'Tus-Resumable',
      'Tus-Version',
      'Tus-Extension',
      'Tus-Max-Size',
      'Upload-Metadata',
      'Upload-Checksum',
    ],
    credentials: true,
  });

  // Serve media files statically with byte range support for smooth video streaming
  const mediaDir = process.env.MEDIA_DIR ?? '/media';
  app.use('/media', express.static(mediaDir, { acceptRanges: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[TakePicker API] Server running on http://localhost:${port}`);
}

bootstrap();
