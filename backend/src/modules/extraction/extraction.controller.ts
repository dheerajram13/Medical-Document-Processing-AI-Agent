import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ExtractionService } from './extraction.service';

@Controller('extraction')
export class ExtractionController {
  private readonly logger = new Logger(ExtractionController.name);

  constructor(private readonly extractionService: ExtractionService) {}

  /**
   * Extract medical fields from OCR text
   */
  @Post('extract')
  async extractFields(@Body('ocrText') ocrText: string) {
    this.logger.log(
      `Extraction request received (${ocrText.length} characters)`,
    );

    try {
      const result =
        await this.extractionService.extractMedicalFields(ocrText);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Extraction failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
