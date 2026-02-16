import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post('extract')
  @UseInterceptors(FileInterceptor('file'))
  async extractText(@UploadedFile() file: Express.Multer.File): Promise<{
    success: boolean;
    data?: {
      text: string;
      pages: number;
      confidence: number;
      metadata: any;
    };
    error?: string;
  }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(
      `OCR extraction request: ${file.originalname} (${file.size} bytes)`,
    );

    try {
      const result = await this.ocrService.extractText(
        file.buffer,
        file.mimetype,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`OCR extraction failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('extract-url')
  async extractTextFromUrl(@Body() body: { url: string }): Promise<{
    success: boolean;
    data?: {
      text: string;
      pages: number;
      confidence: number;
      metadata: any;
    };
    error?: string;
  }> {
    if (!body.url) {
      throw new BadRequestException('URL is required');
    }

    this.logger.log(`OCR extraction from URL: ${body.url}`);

    try {
      const result = await this.ocrService.extractTextFromUrl(body.url);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`OCR extraction from URL failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
