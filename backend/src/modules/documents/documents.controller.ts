import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';

type UpdateExtractedDataBody = {
  patientName?: string;
  reportDate?: string;
  subject?: string;
  sourceContact?: string;
  storeIn?: 'Investigations' | 'Correspondence';
  assignedDoctor?: string;
  category?: string;
};

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Complete document processing endpoint
   * Upload PDF → OCR → AI Extraction → Save to DB
   */
  @Post('process')
  @UseInterceptors(FileInterceptor('file'))
  async processDocument(@UploadedFile() file: Express.Multer.File) {
    this.logger.log(
      `Document processing request: ${file.originalname} (${file.size} bytes)`,
    );

    try {
      const result = await this.documentsService.processDocument(file);

      return {
        success: true,
        message: 'Document processed successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Processing failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all documents in review queue
   * NOTE: Static paths must be declared before the :id wildcard param
   */
  @Get('queue/review')
  async getReviewQueue() {
    try {
      const documents = await this.documentsService.getReviewQueue();

      return {
        success: true,
        count: documents.length,
        data: documents,
      };
    } catch (error) {
      this.logger.error(`Failed to get review queue: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Lookup values for dropdown/search controls in review form
   */
  @Get('lookups/patients')
  async getPatientLookup(@Query('q') query = '') {
    try {
      const data = await this.documentsService.getPatientLookup(query);
      return {
        success: true,
        count: data.length,
        data,
      };
    } catch (error) {
      this.logger.error(`Failed to load patient lookup: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('lookups/doctors')
  async getDoctorLookup(@Query('q') query = '') {
    try {
      const data = await this.documentsService.getDoctorLookup(query);
      return {
        success: true,
        count: data.length,
        data,
      };
    } catch (error) {
      this.logger.error(`Failed to load doctor lookup: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('lookups/sources')
  async getSourceContactLookup(@Query('q') query = '') {
    try {
      const data = await this.documentsService.getSourceContactLookup(query);
      return {
        success: true,
        count: data.length,
        data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to load source contact lookup: ${error.message}`,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get document with extracted data
   * NOTE: Wildcard :id must come after all static paths to avoid shadowing
   */
  @Get(':id')
  async getDocument(@Param('id') id: string) {
    try {
      const document = await this.documentsService.getDocument(id);

      return {
        success: true,
        data: document,
      };
    } catch (error) {
      this.logger.error(`Failed to get document: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update extracted data (user corrections)
   */
  @Post(':id/update')
  async updateExtractedData(
    @Param('id') id: string,
    @Body() updates: UpdateExtractedDataBody,
  ) {
    this.logger.log(`Update request for document: ${id}`);

    try {
      await this.documentsService.updateExtractedData(id, updates);

      return {
        success: true,
        message: 'Extracted data updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Approve document (mark as completed)
   */
  @Post(':id/approve')
  async approveDocument(@Param('id') id: string) {
    this.logger.log(`Approve request for document: ${id}`);

    try {
      await this.documentsService.approveDocument(id);

      return {
        success: true,
        message: 'Document approved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to approve: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reject document (mark as failed)
   */
  @Post(':id/reject')
  async rejectDocument(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    this.logger.log(`Reject request for document: ${id}`);

    try {
      await this.documentsService.rejectDocument(id, body.reason);

      return {
        success: true,
        message: 'Document rejected successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to reject: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
