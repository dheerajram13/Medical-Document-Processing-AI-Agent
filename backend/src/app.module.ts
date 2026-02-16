import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './modules/ocr/ocr.module';
import { ExtractionModule } from './modules/extraction/extraction.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env', // Load from root .env
    }),
    OcrModule,
    ExtractionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
