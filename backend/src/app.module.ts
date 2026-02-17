import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './modules/ocr/ocr.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ObservabilityModule } from './modules/observability/observability.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', // Load from backend/.env
    }),
    ObservabilityModule,
    OcrModule,
    ExtractionModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
