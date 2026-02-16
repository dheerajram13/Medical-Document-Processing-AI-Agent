import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedFields {
  patientName: string;
  patientNameConfidence: number;
  reportDate: string;
  reportDateConfidence: number;
  subject: string;
  subjectConfidence: number;
  sourceContact: string;
  sourceContactConfidence: number;
  storeIn: 'Investigations' | 'Correspondence';
  storeInConfidence: number;
  assignedDoctor: string;
  assignedDoctorConfidence: number;
  category: string;
  categoryConfidence: number;
}

type AIProvider = 'gemini' | 'claude';

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private provider: AIProvider;

  // Gemini configuration
  private geminiApiKey: string | null = null;
  private geminiModel = 'gemini-2.0-flash';

  // Claude configuration
  private claudeClient: Anthropic | null = null;
  private claudeModel = 'claude-3-haiku-20240307';

  constructor(private configService: ConfigService) {
    // Determine which AI provider to use
    const providerConfig = this.configService.get<string>('AI_PROVIDER') || 'gemini';
    this.provider = providerConfig as AIProvider;

    // Initialize Gemini if available
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.geminiApiKey = geminiKey;
      this.logger.log(`Gemini API configured (${this.geminiModel})`);
    }

    // Initialize Claude if available
    const claudeKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (claudeKey) {
      this.claudeClient = new Anthropic({ apiKey: claudeKey });
      this.logger.log(`Claude API configured (${this.claudeModel})`);
    }

    // Validate at least one provider is configured
    if (!this.geminiApiKey && !this.claudeClient) {
      throw new Error('No AI provider configured. Please set GEMINI_API_KEY or ANTHROPIC_API_KEY');
    }

    // Set default provider based on availability
    if (this.provider === 'gemini' && !this.geminiApiKey) {
      if (this.claudeClient) {
        this.provider = 'claude';
        this.logger.warn('Gemini not configured, falling back to Claude');
      } else {
        throw new Error('Gemini selected but GEMINI_API_KEY not configured');
      }
    }

    if (this.provider === 'claude' && !this.claudeClient) {
      if (this.geminiApiKey) {
        this.provider = 'gemini';
        this.logger.warn('Claude not configured, falling back to Gemini');
      } else {
        throw new Error('Claude selected but ANTHROPIC_API_KEY not configured');
      }
    }

    this.logger.log(`AI Extraction Service initialized with provider: ${this.provider.toUpperCase()}`);
  }

  /**
   * Extract structured medical fields from OCR text using configured AI provider
   * @param ocrText - Raw text extracted from the document
   * @returns Extracted fields with confidence scores
   */
  async extractMedicalFields(ocrText: string): Promise<{
    extractedFields: ExtractedFields;
    rawResponse: any;
  }> {
    this.logger.log(`Starting AI extraction with ${this.provider.toUpperCase()}`);

    try {
      if (this.provider === 'gemini') {
        return await this.extractWithGemini(ocrText);
      } else {
        return await this.extractWithClaude(ocrText);
      }
    } catch (error) {
      this.logger.error(
        `AI extraction failed with ${this.provider}: ${error.message}`,
      );

      // Try fallback to other provider if available
      const fallbackProvider = this.provider === 'gemini' ? 'claude' : 'gemini';
      const canFallback = fallbackProvider === 'gemini' ? this.geminiApiKey : this.claudeClient;

      if (canFallback) {
        this.logger.warn(`Attempting fallback to ${fallbackProvider.toUpperCase()}`);
        try {
          if (fallbackProvider === 'gemini') {
            return await this.extractWithGemini(ocrText);
          } else {
            return await this.extractWithClaude(ocrText);
          }
        } catch (fallbackError) {
          this.logger.error(`Fallback to ${fallbackProvider} also failed: ${fallbackError.message}`);
          throw new Error(`All AI providers failed. Last error: ${fallbackError.message}`);
        }
      }

      throw new Error(`Failed to extract fields: ${error.message}`);
    }
  }

  /**
   * Extract using Google Gemini
   */
  private async extractWithGemini(ocrText: string): Promise<{
    extractedFields: ExtractedFields;
    rawResponse: any;
  }> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not available');
    }

    const prompt = this.buildExtractionPrompt(ocrText);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    const response = await axios.post(url, {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2000,
      },
    });

    const responseText = response.data.candidates[0].content.parts[0].text;
    this.logger.log('Received Gemini response, parsing extracted fields');

    const extractedData = this.parseAIResponse(responseText);

    this.logger.log(
      `Gemini extraction completed: Patient=${extractedData.patientName}, Date=${extractedData.reportDate}`,
    );

    return {
      extractedFields: extractedData,
      rawResponse: {
        provider: 'gemini',
        model: this.geminiModel,
        usage: response.data.usageMetadata,
        fullResponse: response.data,
      },
    };
  }

  /**
   * Extract using Anthropic Claude
   */
  private async extractWithClaude(ocrText: string): Promise<{
    extractedFields: ExtractedFields;
    rawResponse: any;
  }> {
    if (!this.claudeClient) {
      throw new Error('Claude client not available');
    }

    const prompt = this.buildExtractionPrompt(ocrText);

    const message = await this.claudeClient.messages.create({
      model: this.claudeModel,
      max_tokens: 2000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const firstBlock = message.content[0];
    const responseText = firstBlock.type === 'text' ? firstBlock.text : '';
    this.logger.log('Received Claude response, parsing extracted fields');

    const extractedData = this.parseAIResponse(responseText);

    this.logger.log(
      `Claude extraction completed: Patient=${extractedData.patientName}, Date=${extractedData.reportDate}`,
    );

    return {
      extractedFields: extractedData,
      rawResponse: {
        provider: 'claude',
        model: message.model,
        usage: message.usage,
        fullResponse: message,
      },
    };
  }

  /**
   * Build the extraction prompt for AI
   */
  private buildExtractionPrompt(ocrText: string): string {
    return `You are a medical document processing assistant. Extract the following fields from the provided medical document text.

For each field, provide:
1. The extracted value
2. A confidence score (0.0 to 1.0) indicating how confident you are in the extraction

**Fields to extract:**

1. **Patient Name** - Full name of the patient
2. **Report Date** - Date of the medical report (format: YYYY-MM-DD)
3. **Subject** - Brief subject/title describing the document (e.g., "Ultrasound Scrotum Report")
4. **Source Contact** - The referring doctor or medical practice name
5. **Store In** - Categorize as either "Investigations" or "Correspondence"
   - Use "Investigations" for test results, imaging reports, pathology, etc.
   - Use "Correspondence" for referral letters, consultation notes, etc.
6. **Assigned Doctor** - The doctor who should review this (often the referring doctor)
7. **Category** - Medical category (e.g., "Radiology", "Pathology", "Cardiology", "General")

**Response format:**
Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

{
  "patientName": "string",
  "patientNameConfidence": 0.95,
  "reportDate": "YYYY-MM-DD",
  "reportDateConfidence": 0.90,
  "subject": "string",
  "subjectConfidence": 0.85,
  "sourceContact": "string",
  "sourceContactConfidence": 0.80,
  "storeIn": "Investigations",
  "storeInConfidence": 0.95,
  "assignedDoctor": "string",
  "assignedDoctorConfidence": 0.75,
  "category": "string",
  "categoryConfidence": 0.90
}

**Document Text:**
${ocrText}

Remember: Return ONLY the JSON object, nothing else.`;
  }

  /**
   * Parse AI response and extract the JSON data
   */
  private parseAIResponse(responseText: string): ExtractedFields {
    try {
      // Remove markdown code blocks if present
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      // Validate required fields
      this.validateExtractedFields(parsed);

      return parsed as ExtractedFields;
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`);
      this.logger.debug(`Raw response: ${responseText}`);
      throw new Error(`Invalid response format from AI: ${error.message}`);
    }
  }

  /**
   * Validate that all required fields are present
   */
  private validateExtractedFields(data: any): void {
    const requiredFields = [
      'patientName',
      'patientNameConfidence',
      'reportDate',
      'reportDateConfidence',
      'subject',
      'subjectConfidence',
      'sourceContact',
      'sourceContactConfidence',
      'storeIn',
      'storeInConfidence',
      'assignedDoctor',
      'assignedDoctorConfidence',
      'category',
      'categoryConfidence',
    ];

    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate storeIn values
    if (data.storeIn !== 'Investigations' && data.storeIn !== 'Correspondence') {
      throw new Error(
        `Invalid storeIn value: ${data.storeIn}. Must be "Investigations" or "Correspondence"`,
      );
    }

    // Validate confidence scores are between 0 and 1
    const confidenceFields = requiredFields.filter((f) =>
      f.endsWith('Confidence'),
    );
    for (const field of confidenceFields) {
      const value = data[field];
      if (typeof value !== 'number' || value < 0 || value > 1) {
        throw new Error(
          `Invalid confidence score for ${field}: ${value}. Must be between 0 and 1`,
        );
      }
    }
  }
}
