import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWT } from 'google-auth-library';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth');


type ExtractTextOptions = {
  includeMetadata?: boolean;
  pollIntervalMs?: number;
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private jwtClient: JWT;
  private readonly processorUrl: string;

  constructor(private configService: ConfigService) {
    const projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');
    const location =
      this.configService.get<string>('GOOGLE_DOCUMENT_AI_LOCATION') || 'us';
    const processorId = this.configService.get<string>(
      'GOOGLE_DOCUMENT_AI_PROCESSOR_ID',
    );
    const keyFilename = this.configService.get<string>(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
    const serviceAccountJson = this.configService.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_JSON',
    );

    if (!projectId || !processorId) {
      throw new Error(
        'Google Document AI credentials not configured (GOOGLE_CLOUD_PROJECT_ID, GOOGLE_DOCUMENT_AI_PROCESSOR_ID)',
      );
    }

    let serviceAccount: { client_email: string; private_key: string };
    if (serviceAccountJson) {
      // Render / cloud: credentials passed as JSON string env var
      serviceAccount = JSON.parse(serviceAccountJson);
    } else if (keyFilename) {
      // Local dev: credentials loaded from file path
      const resolvedKeyPath = path.resolve(process.cwd(), keyFilename);
      serviceAccount = JSON.parse(fs.readFileSync(resolvedKeyPath, 'utf8'));
    } else {
      throw new Error(
        'No Google credentials configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS',
      );
    }
    this.jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    this.processorUrl = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;
    this.logger.log(`Google Document AI initialized — endpoint: ${this.processorUrl}`);
  }

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

    // DOCX: Google Document AI doesn't support it — use mammoth
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return {
        text: result.value,
        pages: 1,
        confidence: 0.9,
        metadata: options.includeMetadata === false ? undefined : { model: 'mammoth', pages: [] },
      };
    }

    try {
      const tokenResponse = await this.jwtClient.getAccessToken();
      const token = tokenResponse.token;

      const response = await axios.post(
        this.processorUrl,
        {
          rawDocument: {
            content: fileBuffer.toString('base64'),
            mimeType,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const result = response.data;

      const document = result.document;
      const fullText = document?.text || '';
      const pages = document?.pages || [];

      const confidences: number[] = [];
      for (const page of pages) {
        for (const line of page.lines || []) {
          const conf = line.layout?.confidence;
          if (conf != null) confidences.push(conf as number);
        }
      }

      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0.9;

      this.logger.log(
        `OCR completed: ${pages.length} pages, ${fullText.length} chars, ${(avgConfidence * 100).toFixed(1)}% confidence`,
      );

      return {
        text: fullText,
        pages: pages.length,
        confidence: avgConfidence,
        metadata:
          options.includeMetadata === false
            ? undefined
            : this.buildMetadata(document),
      };
    } catch (error) {
      const msg = error.response?.data?.error?.message || error.message;
      this.logger.error(`OCR extraction failed: ${msg}`, error.stack);
      throw new Error(`Failed to extract text: ${msg}`);
    }
  }

  async extractTextFromUrl(documentUrl: string): Promise<{
    text: string;
    pages: number;
    confidence: number;
    metadata?: any;
  }> {
    this.logger.log(`Starting OCR extraction from URL: ${documentUrl}`);

    try {
      const response = await axios.get<ArrayBuffer>(documentUrl, {
        responseType: 'arraybuffer',
      });

      const contentType =
        (response.headers['content-type'] as string) || 'application/pdf';
      const mimeType = contentType.split(';')[0].trim();
      const buffer = Buffer.from(response.data);

      return this.extractText(buffer, mimeType, { includeMetadata: true });
    } catch (error) {
      this.logger.error(
        `OCR extraction from URL failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to extract text from URL: ${error.message}`);
    }
  }

  private buildMetadata(document: any): {
    model: string;
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
    const pages = document?.pages || [];
    const fullText: string = document?.text || '';

    return {
      model: 'google-document-ai',
      pages: pages.map((page: any) => {
        const pageNumber = page.pageNumber ?? 1;
        // Google returns normalizedVertices (0–1 scale).
        // We set width=1, height=1 so the frontend percentage math
        // (x / width * 100) becomes (x * 100) — correct for 0–1 coords.
        const lineItems = (page.lines || [])
          .map((line: any) => {
            const content = this.extractTextSegment(
              fullText,
              line.layout?.textAnchor,
            );
            const polygon = this.normalizeVertices(
              line.layout?.boundingPoly?.normalizedVertices,
            );
            return { content, polygon };
          })
          .filter(
            (item: any) =>
              item.content.trim().length > 0 && item.polygon.length >= 4,
          );

        return {
          pageNumber,
          width: 1,
          height: 1,
          unit: 'normalized',
          lines: page.lines?.length || 0,
          words: page.tokens?.length || 0,
          lineItems,
        };
      }),
    };
  }

  private extractTextSegment(fullText: string, textAnchor: any): string {
    if (!textAnchor?.textSegments?.length) return '';
    return textAnchor.textSegments
      .map((seg: any) => {
        const start = Number(seg.startIndex ?? 0);
        const end = Number(seg.endIndex ?? 0);
        return fullText.slice(start, end);
      })
      .join('')
      .replace(/\n$/, '');
  }

  private normalizeVertices(
    vertices: Array<{ x?: number | null; y?: number | null }> | undefined,
  ): Array<{ x: number; y: number }> {
    if (!Array.isArray(vertices) || vertices.length === 0) return [];
    return vertices.map((v) => ({
      x: typeof v.x === 'number' ? v.x : 0,
      y: typeof v.y === 'number' ? v.y : 0,
    }));
  }
}
