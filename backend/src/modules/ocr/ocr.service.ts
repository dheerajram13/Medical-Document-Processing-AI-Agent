import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DocumentAnalysisClient,
  AzureKeyCredential,
  type DocumentPage,
} from '@azure/ai-form-recognizer';

type ExtractTextOptions = {
  includeMetadata?: boolean;
  pollIntervalMs?: number;
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private client: DocumentAnalysisClient;
  private readonly defaultPollIntervalMs: number;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>(
      'AZURE_DOC_INTELLIGENCE_ENDPOINT',
    );
    const apiKey = this.configService.get<string>('AZURE_DOC_INTELLIGENCE_KEY');

    if (!endpoint || !apiKey) {
      throw new Error('Azure Document Intelligence credentials not configured');
    }

    this.client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(apiKey),
    );
    this.defaultPollIntervalMs = this.parsePositiveInt(
      this.configService.get<string>('OCR_POLL_INTERVAL_MS'),
      1000,
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
    options: ExtractTextOptions = {},
  ): Promise<{
    text: string;
    pages: number;
    confidence: number;
    metadata?: any;
  }> {
    this.logger.log(`Starting OCR extraction for ${mimeType} document`);

    try {
      const pollIntervalMs = this.resolvePollInterval(options);
      // Use prebuilt-read model for general text extraction
      const poller = await this.client.beginAnalyzeDocument(
        'prebuilt-read',
        fileBuffer,
        {
          updateIntervalInMs: pollIntervalMs,
        },
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
        metadata:
          options.includeMetadata === false
            ? undefined
            : this.buildMetadata(pages),
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
    metadata?: any;
  }> {
    this.logger.log(`Starting OCR extraction from URL: ${documentUrl}`);

    try {
      const pollIntervalMs = this.defaultPollIntervalMs;
      const poller = await this.client.beginAnalyzeDocumentFromUrl(
        'prebuilt-read',
        documentUrl,
        {
          updateIntervalInMs: pollIntervalMs,
        },
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
        metadata: this.buildMetadata(pages),
      };
    } catch (error) {
      this.logger.error(
        `OCR extraction from URL failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to extract text from URL: ${error.message}`);
    }
  }

  private parsePositiveInt(
    value: string | undefined,
    fallback: number,
  ): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private resolvePollInterval(options: ExtractTextOptions): number {
    if (
      typeof options.pollIntervalMs === 'number' &&
      Number.isFinite(options.pollIntervalMs) &&
      options.pollIntervalMs > 0
    ) {
      return options.pollIntervalMs;
    }
    return this.defaultPollIntervalMs;
  }

  private toFiniteNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  private normalizePolygon(
    polygon: unknown,
  ): Array<{ x: number; y: number }> {
    if (!Array.isArray(polygon) || polygon.length === 0) {
      return [];
    }

    // Azure SDK may expose polygon as [x1, y1, x2, y2, ...]
    if (typeof polygon[0] === 'number') {
      const points: Array<{ x: number; y: number }> = [];
      const coords = polygon as number[];
      for (let index = 0; index + 1 < coords.length; index += 2) {
        const x = this.toFiniteNumber(coords[index]);
        const y = this.toFiniteNumber(coords[index + 1]);
        if (x === null || y === null) {
          continue;
        }
        points.push({ x, y });
      }
      return points;
    }

    // Or as [{ x, y }, ...]
    const points: Array<{ x: number; y: number }> = [];
    for (const point of polygon as Array<{ x?: unknown; y?: unknown }>) {
      const x = this.toFiniteNumber(point?.x);
      const y = this.toFiniteNumber(point?.y);
      if (x === null || y === null) {
        continue;
      }
      points.push({ x, y });
    }
    return points;
  }

  private buildMetadata(pages: DocumentPage[]): {
    model: 'prebuilt-read';
    pages: Array<{
      pageNumber: number;
      width: number | null;
      height: number | null;
      unit: string | null;
      lines: number;
      words: number;
      lineItems: Array<{
        content: string;
        polygon: Array<{ x: number; y: number }>;
      }>;
    }>;
  } {
    return {
      model: 'prebuilt-read',
      pages: pages.map((page, index) => ({
        pageNumber:
          typeof page.pageNumber === 'number' ? page.pageNumber : index + 1,
        width: this.toFiniteNumber(page.width),
        height: this.toFiniteNumber(page.height),
        unit: typeof page.unit === 'string' ? page.unit : null,
        lines: page.lines?.length || 0,
        words: page.words?.length || 0,
        lineItems: (page.lines || [])
          .map((line) => ({
            content: line.content,
            polygon: this.normalizePolygon(line.polygon),
          }))
          .filter(
            (line) =>
              line.content.trim().length > 0 && line.polygon.length >= 4,
          ),
      })),
    };
  }
}
