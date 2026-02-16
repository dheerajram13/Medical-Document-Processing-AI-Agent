import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentAnalysisClient,
  AzureKeyCredential,
} from '@azure/ai-form-recognizer';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private client: DocumentAnalysisClient;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>(
      'AZURE_DOC_INTELLIGENCE_ENDPOINT',
    );
    const apiKey = this.configService.get<string>(
      'AZURE_DOC_INTELLIGENCE_KEY',
    );

    if (!endpoint || !apiKey) {
      throw new Error(
        'Azure Document Intelligence credentials not configured',
      );
    }

    this.client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(apiKey),
    );

    this.logger.log('Azure Document Intelligence client initialized');
  }

  /**
   * Extract text from a document using Azure Document Intelligence
   * @param fileBuffer - The document file as a buffer
   * @param mimeType - MIME type of the document
   * @returns Extracted text and metadata
   */
  async extractText(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{
    text: string;
    pages: number;
    confidence: number;
    metadata: any;
  }> {
    this.logger.log(`Starting OCR extraction for ${mimeType} document`);

    try {
      // Use prebuilt-read model for general text extraction
      const poller = await this.client.beginAnalyzeDocument(
        'prebuilt-read' as any,
        fileBuffer,
      );

      const result = await poller.pollUntilDone();

      // Extract all text content
      let fullText = '';
      const pages = result.pages || [];

      for (const page of pages) {
        for (const line of page.lines || []) {
          fullText += line.content + '\n';
        }
      }

      // Calculate average confidence
      const confidences: number[] = [];
      for (const page of pages) {
        for (const word of page.words || []) {
          if (word.confidence !== undefined) {
            confidences.push(word.confidence);
          }
        }
      }

      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

      this.logger.log(
        `OCR completed: ${pages.length} pages, ${fullText.length} characters, ${(avgConfidence * 100).toFixed(1)}% confidence`,
      );

      return {
        text: fullText,
        pages: pages.length,
        confidence: avgConfidence,
        metadata: {
          model: 'prebuilt-read',
          pages: pages.map((page, idx) => ({
            pageNumber: idx + 1,
            width: page.width,
            height: page.height,
            unit: page.unit,
            lines: page.lines?.length || 0,
            words: page.words?.length || 0,
          })),
        },
      };
    } catch (error) {
      this.logger.error(`OCR extraction failed: ${error.message}`, error.stack);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  /**
   * Extract text from a document URL
   * @param documentUrl - URL to the document
   * @returns Extracted text and metadata
   */
  async extractTextFromUrl(documentUrl: string): Promise<{
    text: string;
    pages: number;
    confidence: number;
    metadata: any;
  }> {
    this.logger.log(`Starting OCR extraction from URL: ${documentUrl}`);

    try {
      const poller = await this.client.beginAnalyzeDocumentFromUrl(
        'prebuilt-read' as any,
        documentUrl,
      );

      const result = await poller.pollUntilDone();

      // Extract all text content
      let fullText = '';
      const pages = result.pages || [];

      for (const page of pages) {
        for (const line of page.lines || []) {
          fullText += line.content + '\n';
        }
      }

      // Calculate average confidence
      const confidences: number[] = [];
      for (const page of pages) {
        for (const word of page.words || []) {
          if (word.confidence !== undefined) {
            confidences.push(word.confidence);
          }
        }
      }

      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

      return {
        text: fullText,
        pages: pages.length,
        confidence: avgConfidence,
        metadata: {
          model: 'prebuilt-read',
          pages: pages.map((page, idx) => ({
            pageNumber: idx + 1,
            lines: page.lines?.length || 0,
            words: page.words?.length || 0,
          })),
        },
      };
    } catch (error) {
      this.logger.error(
        `OCR extraction from URL failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to extract text from URL: ${error.message}`);
    }
  }
}
