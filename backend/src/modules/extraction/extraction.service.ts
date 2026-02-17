import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedFields {
  // Core 7 fields (required)
  patientName: string | null;
  patientNameConfidence: number;
  reportDate: string | null;
  reportDateConfidence: number;
  subject: string | null;
  subjectConfidence: number;
  sourceContact: string | null;
  sourceContactConfidence: number;
  storeIn: 'Investigations' | 'Correspondence';
  storeInConfidence: number;
  assignedDoctor: string | null;
  assignedDoctorConfidence: number;
  category: string | null;
  categoryConfidence: number;
  // Additional fields (bonus)
  patientDob: string | null;
  patientDobConfidence: number;
  patientId: string | null;
  patientIdConfidence: number;
  specialist: string | null;
  specialistConfidence: number;
  facility: string | null;
  facilityConfidence: number;
  urgency: 'Normal' | 'Urgent' | 'Critical';
  urgencyConfidence: number;
  summary: string | null;
  summaryConfidence: number;
}

type AIProvider = 'gemini' | 'claude';

type ExtractionContext = {
  fileName?: string;
};

const DOCUMENT_CATEGORIES = [
  'Admissions summary',
  'Advance care planning',
  'Allied health letter',
  'Certificate',
  'Clinical notes',
  'Clinical photograph',
  'Consent form',
  'DAS21',
  'Discharge summary',
  'ECG',
  'Email',
  'Form',
  'Immunisation',
  'Indigenous PIP',
  'Letter',
  'Medical imaging report',
  'MyHealth registration',
  'New PT registration form',
  'Pathology results',
  'Patient consent',
  'Record request',
  'Referral letter',
  'Workcover',
  'Workcover consent',
] as const;

const CATEGORY_CANONICAL_MAP = new Map(
  DOCUMENT_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private provider: AIProvider;
  private readonly maxOutputTokens: number;
  private readonly maxPromptChars: number;
  private readonly requestTimeoutMs: number;

  // Gemini configuration
  private geminiApiKey: string | null = null;
  private geminiModel = 'gemini-2.0-flash';

  // Claude configuration
  private claudeClient: Anthropic | null = null;
  private claudeModel = 'claude-3-haiku-20240307';

  constructor(private configService: ConfigService) {
    this.maxOutputTokens = this.parsePositiveInt(
      this.configService.get<string>('AI_MAX_OUTPUT_TOKENS'),
      2000,
    );
    this.maxPromptChars = this.parsePositiveInt(
      this.configService.get<string>('AI_MAX_PROMPT_CHARS'),
      250000,
    );
    this.requestTimeoutMs = this.parsePositiveInt(
      this.configService.get<string>('AI_REQUEST_TIMEOUT_MS'),
      0,
    );

    // Determine which AI provider to use
    const providerConfig =
      this.configService.get<string>('AI_PROVIDER') || 'gemini';
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
      throw new Error(
        'No AI provider configured. Please set GEMINI_API_KEY or ANTHROPIC_API_KEY',
      );
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

    this.logger.log(
      `AI Extraction Service initialized with provider: ${this.provider.toUpperCase()}`,
    );
    this.logger.log(
      `AI extraction tuning: maxOutputTokens=${this.maxOutputTokens}, maxPromptChars=${this.maxPromptChars}, timeoutMs=${this.requestTimeoutMs}`,
    );
  }

  /**
   * Extract structured medical fields from OCR text using configured AI provider
   * @param ocrText - Raw text extracted from the document
   * @returns Extracted fields with confidence scores
   */
  async extractMedicalFields(
    ocrText: string,
    context: ExtractionContext = {},
  ): Promise<{
    extractedFields: ExtractedFields;
    rawResponse: any;
  }> {
    this.logger.log(
      `Starting AI extraction with ${this.provider.toUpperCase()}`,
    );

    try {
      if (this.provider === 'gemini') {
        return await this.extractWithGemini(ocrText, context);
      } else {
        return await this.extractWithClaude(ocrText, context);
      }
    } catch (error) {
      this.logger.error(
        `AI extraction failed with ${this.provider}: ${error.message}`,
      );

      // Try fallback to other provider if available
      const fallbackProvider = this.provider === 'gemini' ? 'claude' : 'gemini';
      const canFallback =
        fallbackProvider === 'gemini' ? this.geminiApiKey : this.claudeClient;

      if (canFallback) {
        this.logger.warn(
          `Attempting fallback to ${fallbackProvider.toUpperCase()}`,
        );
        try {
          if (fallbackProvider === 'gemini') {
            return await this.extractWithGemini(ocrText, context);
          } else {
            return await this.extractWithClaude(ocrText, context);
          }
        } catch (fallbackError) {
          this.logger.error(
            `Fallback to ${fallbackProvider} also failed: ${fallbackError.message}`,
          );
          throw new Error(
            `All AI providers failed. Last error: ${fallbackError.message}`,
          );
        }
      }

      throw new Error(`Failed to extract fields: ${error.message}`);
    }
  }

  /**
   * Extract using Google Gemini
   */
  private async extractWithGemini(
    ocrText: string,
    context: ExtractionContext = {},
  ): Promise<{
    extractedFields: ExtractedFields;
    rawResponse: any;
  }> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not available');
    }

    const preparedPrompt = this.preparePromptText(ocrText);
    const prompt = this.buildExtractionPrompt(preparedPrompt.text);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;

    let response = await this.callGemini(url, prompt);

    const responseText = String(
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    );
    if (!responseText) {
      throw new Error('Empty response text from Gemini');
    }
    this.logger.log('Received Gemini response, parsing extracted fields');

    let extractedData = this.enrichExtractedFields(
      this.parseAIResponse(responseText),
      ocrText,
      context,
    );

    // Accuracy guardrail: if fast-mode truncation was used and required
    // fields are weak/missing, retry once with full OCR text.
    if (
      preparedPrompt.truncated &&
      this.shouldRetryWithFullTextForAccuracy(extractedData)
    ) {
      this.logger.warn(
        'Fast prompt appears incomplete for required fields. Retrying Gemini with full OCR text to preserve accuracy.',
      );
      const fullPrompt = this.buildExtractionPrompt(ocrText);
      response = await this.callGemini(url, fullPrompt);
      const fullResponseText = String(
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      );
      if (!fullResponseText) {
        throw new Error('Empty response text from Gemini full-text retry');
      }
      extractedData = this.enrichExtractedFields(
        this.parseAIResponse(fullResponseText),
        ocrText,
        context,
      );
    }

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
  private async extractWithClaude(
    ocrText: string,
    context: ExtractionContext = {},
  ): Promise<{
    extractedFields: ExtractedFields;
    rawResponse: any;
  }> {
    if (!this.claudeClient) {
      throw new Error('Claude client not available');
    }

    const preparedPrompt = this.preparePromptText(ocrText);
    const prompt = this.buildExtractionPrompt(preparedPrompt.text);

    let message = await this.callClaude(prompt);

    const firstBlock = message.content[0];
    const responseText = firstBlock.type === 'text' ? firstBlock.text : '';
    this.logger.log('Received Claude response, parsing extracted fields');

    let extractedData = this.enrichExtractedFields(
      this.parseAIResponse(responseText),
      ocrText,
      context,
    );

    if (
      preparedPrompt.truncated &&
      this.shouldRetryWithFullTextForAccuracy(extractedData)
    ) {
      this.logger.warn(
        'Fast prompt appears incomplete for required fields. Retrying Claude with full OCR text to preserve accuracy.',
      );
      const fullPrompt = this.buildExtractionPrompt(ocrText);
      message = await this.callClaude(fullPrompt);
      const retryBlock = message.content[0];
      const retryText = retryBlock.type === 'text' ? retryBlock.text : '';
      if (!retryText) {
        throw new Error('Empty response text from Claude full-text retry');
      }
      extractedData = this.enrichExtractedFields(
        this.parseAIResponse(retryText),
        ocrText,
        context,
      );
    }

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
1. The extracted value (use null if not found)
2. A confidence score (0.0 to 1.0) indicating how confident you are in the extraction

**Core fields to extract (required):**

1. **Patient Name** - Full name of the patient
2. **Report Date** - Date of the medical report (format: YYYY-MM-DD). Must be a valid calendar date.
3. **Subject** - Brief subject/title describing the document (e.g., "Ultrasound Scrotum Report")
4. **Source Contact** - The referring doctor or medical practice name that sent/created the document
5. **Store In** - Categorize as either "Investigations" or "Correspondence"
   - Use "Investigations" for test results, imaging reports, pathology, etc.
   - Use "Correspondence" for referral letters, consultation notes, discharge summaries, etc.
6. **Assigned Doctor** - The GP doctor who should review this (the referring GP, NOT the reporting specialist)
7. **Category** - Must be one of: "Medical imaging report", "Pathology results", "Discharge summary", "Referral letter", "Letter", "ECG", "Certificate", "Allied health letter", "Immunisation", "Clinical notes", "Consent form", "Admissions summary", "Advance care planning", "Clinical photograph", "DAS21", "Email", "Form", "Indigenous PIP", "MyHealth registration", "New PT registration form", "Patient consent", "Record request", "Workcover", "Workcover consent"

**Additional fields to extract (if available):**

8. **Patient DOB** - Patient date of birth (format: YYYY-MM-DD). Must be a valid calendar date.
9. **Patient ID** - Medical Record Number (MRN) or patient identifier
10. **Specialist** - The specialist/reporting doctor who authored the report (different from the assigned GP)
11. **Facility** - Hospital or clinic name where the report was generated
12. **Urgency** - "Normal", "Urgent", or "Critical" based on the document content
13. **Summary** - A brief 1-2 sentence summary of the key findings or purpose of the document

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
  "categoryConfidence": 0.90,
  "patientDob": "YYYY-MM-DD or null",
  "patientDobConfidence": 0.90,
  "patientId": "string or null",
  "patientIdConfidence": 0.85,
  "specialist": "string or null",
  "specialistConfidence": 0.80,
  "facility": "string or null",
  "facilityConfidence": 0.85,
  "urgency": "Normal",
  "urgencyConfidence": 0.70,
  "summary": "string or null",
  "summaryConfidence": 0.80
}

**Document Text:**
${ocrText}

Remember: Return ONLY the JSON object, nothing else.`;
  }

  private parsePositiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private preparePromptText(ocrText: string): {
    text: string;
    truncated: boolean;
  } {
    const compact = ocrText
      .replace(/\r/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (compact.length <= this.maxPromptChars) {
      return {
        text: compact,
        truncated: false,
      };
    }

    const marker = '\n\n[...TRUNCATED OCR TEXT...]\n\n';
    const targetLength = Math.max(this.maxPromptChars - marker.length, 1200);
    const headLength = Math.floor(targetLength * 0.7);
    const tailLength = targetLength - headLength;
    const truncated = `${compact.slice(0, headLength)}${marker}${compact.slice(
      Math.max(compact.length - tailLength, 0),
    )}`;

    this.logger.warn(
      `OCR text trimmed for AI prompt: ${compact.length} -> ${truncated.length} chars`,
    );
    return {
      text: truncated,
      truncated: true,
    };
  }

  private shouldRetryWithFullTextForAccuracy(fields: ExtractedFields): boolean {
    const requiredTextFields = [
      fields.patientName,
      fields.reportDate,
      fields.subject,
      fields.sourceContact,
      fields.assignedDoctor,
      fields.category,
    ];
    const missingRequiredText = requiredTextFields.some(
      (value) => typeof value !== 'string' || value.trim().length === 0,
    );
    const weakCoreConfidence =
      fields.patientNameConfidence < 0.45 ||
      fields.reportDateConfidence < 0.45 ||
      fields.sourceContactConfidence < 0.4 ||
      fields.assignedDoctorConfidence < 0.4 ||
      fields.categoryConfidence < 0.45;

    return missingRequiredText || weakCoreConfidence;
  }

  private async callGemini(url: string, prompt: string): Promise<any> {
    const body = {
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
        maxOutputTokens: this.maxOutputTokens,
      },
    };

    if (this.requestTimeoutMs > 0) {
      return axios.post(url, body, {
        timeout: this.requestTimeoutMs,
      });
    }

    return axios.post(url, body);
  }

  private async callClaude(prompt: string): Promise<Anthropic.Message> {
    if (!this.claudeClient) {
      throw new Error('Claude client not available');
    }

    const body = {
      model: this.claudeModel,
      max_tokens: this.maxOutputTokens,
      temperature: 0 as const,
      messages: [
        {
          role: 'user' as const,
          content: prompt,
        },
      ],
    };

    if (this.requestTimeoutMs > 0) {
      return this.claudeClient.messages.create(body, {
        timeout: this.requestTimeoutMs,
      });
    }

    return this.claudeClient.messages.create(body);
  }

  private hasText(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private normalizePersonOrOrgText(value: string): string {
    return value.replace(/\s+/g, ' ').replace(/[|]/g, '').trim();
  }

  /**
   * Check whether a value looks like a plausible person or organisation name
   * rather than a sentence, question, or form field label.
   */
  private looksLikeNameOrOrg(value: string | null | undefined): boolean {
    if (!this.hasText(value)) {
      return false;
    }
    const trimmed = this.normalizePersonOrOrgText(value);
    // Reject questions or sentences
    if (/[?]/.test(trimmed)) {
      return false;
    }
    // Reject values that are too long (names/org names are short)
    if (trimmed.length > 80) {
      return false;
    }
    // Reject common form-field junk patterns
    if (
      /\b(consent|privacy|confidential|legislation|do you|please|enter|select|tick|new patient form|personal details information sheet|intake form|relationship to|same as)\b/i.test(
        trimmed,
      )
    ) {
      return false;
    }
    // Reject values that look like "Not Specified", "N/A", "GP", "Unknown"
    if (/^(not specified|n\/?a|unknown|gp|none|null|undefined)$/i.test(trimmed)) {
      return false;
    }
    return true;
  }

  private looksLikeDoctorName(value: string | null | undefined): boolean {
    if (!this.hasText(value) || !this.looksLikeNameOrOrg(value)) {
      return false;
    }

    const trimmed = this.normalizePersonOrOrgText(value);
    if (
      /\b(clinic|hospital|radiology|imaging|pathology|medical|centre|center|practice|laboratory|lab|health|diagnostic|surgery)\b/i.test(
        trimmed,
      )
    ) {
      return false;
    }

    const withoutPrefix = trimmed
      .replace(/^dr\.?\s+/i, '')
      .replace(/^doctor\s+/i, '');
    const tokens = withoutPrefix.split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 4) {
      return false;
    }
    if (tokens.some((token) => /[0-9]/.test(token))) {
      return false;
    }

    return tokens.every((token) => /^[A-Za-z][A-Za-z'.-]*$/.test(token));
  }

  private looksLikeSourceContact(value: string | null | undefined): boolean {
    if (!this.hasText(value) || !this.looksLikeNameOrOrg(value)) {
      return false;
    }

    const trimmed = this.normalizePersonOrOrgText(value);
    if (
      /\b(clinic|hospital|radiology|imaging|pathology|medical|centre|center|practice|laboratory|lab|health|specialist|diagnostic|surgery)\b/i.test(
        trimmed,
      )
    ) {
      return true;
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 4) {
      return false;
    }
    if (tokens.some((token) => /[0-9]/.test(token))) {
      return false;
    }

    return tokens.every((token) => /^[A-Za-z][A-Za-z'.-]*$/.test(token));
  }

  private sanitizeText(value: string): string {
    return this.normalizePersonOrOrgText(value);
  }

  private normalizeCategory(value: string | null | undefined): string | null {
    if (!this.hasText(value)) {
      return null;
    }

    return CATEGORY_CANONICAL_MAP.get(value.trim().toLowerCase()) ?? null;
  }

  private isValidIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }

  private normalizeDateToIso(value: string | null | undefined): string | null {
    if (!this.hasText(value)) {
      return null;
    }

    const raw = value.replace(/[.,;]+$/g, '').trim();

    if (this.isValidIsoDate(raw)) {
      return raw;
    }

    const dmyOrMdy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dmyOrMdy) {
      const left = Number(dmyOrMdy[1]);
      const middle = Number(dmyOrMdy[2]);
      const right = Number(dmyOrMdy[3]);
      if (Number.isNaN(left) || Number.isNaN(middle) || Number.isNaN(right)) {
        return null;
      }

      // Default to day-first because source documents are AU-centric.
      const day = left;
      const month = middle;
      const year =
        right < 100 ? (right <= 30 ? 2000 + right : 1900 + right) : right;
      const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return this.isValidIsoDate(iso) ? iso : null;
    }

    const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) {
      const iso = `${compact[1]}-${compact[2]}-${compact[3]}`;
      return this.isValidIsoDate(iso) ? iso : null;
    }

    return null;
  }

  private extractDateToken(input: string): string | null {
    const dateMatch = input.match(
      /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{8})\b/,
    );
    if (!dateMatch) {
      return null;
    }

    return this.normalizeDateToIso(dateMatch[1]);
  }

  private deriveReportDate(
    ocrText: string,
    fileName?: string,
  ): { value: string; confidence: number } | null {
    const lines = ocrText
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let i = 0; i < lines.length; i += 1) {
      const current = lines[i];
      const next = lines[i + 1] ?? '';
      const nextTwo = lines[i + 2] ?? '';
      const window = `${current} ${next} ${nextTwo}`;
      const dateContext =
        /signature|date/i.test(current) || /signature|date/i.test(next);
      const blockedContext =
        /birth|dob|expiry|cervical|prostate|medicare/i.test(window);
      if (!dateContext || blockedContext) {
        continue;
      }

      const token = this.extractDateToken(window);
      if (token) {
        return { value: token, confidence: 0.75 };
      }
    }

    if (this.hasText(fileName)) {
      const compactDate = fileName.match(
        /(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])\d{6}/,
      );
      if (compactDate) {
        const iso = `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`;
        if (this.isValidIsoDate(iso)) {
          return { value: iso, confidence: 0.45 };
        }
      }
    }

    return null;
  }

  private isRegistrationForm(
    ocrText: string,
    fields: ExtractedFields,
  ): boolean {
    const loweredText = ocrText.toLowerCase();
    const subject = String(fields.subject ?? '').toLowerCase();
    const category = String(fields.category ?? '').toLowerCase();

    return (
      loweredText.includes('new patient form') ||
      loweredText.includes('personal details information sheet') ||
      loweredText.includes('keeping you and your family in good health') ||
      loweredText.includes('clinical information form') ||
      subject.includes('new patient') ||
      subject.includes('personal details') ||
      category === 'new pt registration form'
    );
  }

  private detectSourceContact(ocrText: string): string | null {
    const lines = ocrText
      .split(/\r?\n/g)
      .map((line) => this.sanitizeText(line))
      .filter(Boolean);

    for (const line of lines) {
      if (
        !/\b(medical hub|medical centre|medical center|general practice|clinic|hospital|radiology|imaging|pathology|health)\b/i.test(
          line,
        )
      ) {
        continue;
      }
      if (
        /confidentiality|privacy|legislation|consent|information|do you|please|enter|select|tick/i.test(
          line,
        )
      ) {
        continue;
      }
      if (line.length < 4 || line.length > 80) {
        continue;
      }
      if (!this.looksLikeSourceContact(line)) {
        continue;
      }
      return line;
    }

    return null;
  }

  private detectAssignedDoctor(ocrText: string): string | null {
    const doctorMatch = ocrText.match(
      /\bDr\.?\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,3}\b/,
    );
    if (!doctorMatch) {
      return null;
    }

    return this.sanitizeText(doctorMatch[0]);
  }

  private enrichExtractedFields(
    extracted: ExtractedFields,
    ocrText: string,
    context: ExtractionContext,
  ): ExtractedFields {
    const next = { ...extracted };
    const registrationForm = this.isRegistrationForm(ocrText, next);
    const normalizedCategory = this.normalizeCategory(next.category);
    next.category = normalizedCategory;

    const normalizedReportDate = this.normalizeDateToIso(next.reportDate);
    if (normalizedReportDate) {
      next.reportDate = normalizedReportDate;
    } else {
      next.reportDate = null;
      next.reportDateConfidence = 0;
      const derivedDate = this.deriveReportDate(ocrText, context.fileName);
      if (derivedDate) {
        next.reportDate = derivedDate.value;
        next.reportDateConfidence = Math.max(
          next.reportDateConfidence,
          derivedDate.confidence,
        );
      }
    }

    const normalizedDob = this.normalizeDateToIso(next.patientDob);
    if (next.patientDob && !normalizedDob) {
      next.patientDob = null;
      next.patientDobConfidence = 0;
    } else if (normalizedDob) {
      next.patientDob = normalizedDob;
    }

    if (registrationForm) {
      if (!normalizedCategory) {
        next.category = 'New PT registration form';
        next.categoryConfidence = Math.max(next.categoryConfidence, 0.88);
      }
      if (!this.hasText(next.subject)) {
        next.subject = ocrText
          .toLowerCase()
          .includes('personal details information sheet')
          ? 'Personal Details Information Sheet'
          : 'New Patient Form';
        next.subjectConfidence = Math.max(next.subjectConfidence, 0.82);
      }

      next.storeIn = 'Correspondence';
      next.storeInConfidence = Math.max(next.storeInConfidence, 0.9);
    }

    // Sanitize: if the AI returned junk (questions, form labels) treat as empty
    if (
      this.hasText(next.sourceContact) &&
      !this.looksLikeSourceContact(next.sourceContact)
    ) {
      this.logger.warn(`Rejected junk sourceContact: "${next.sourceContact}"`);
      next.sourceContact = null;
      next.sourceContactConfidence = 0;
    }
    if (
      this.hasText(next.assignedDoctor) &&
      !this.looksLikeDoctorName(next.assignedDoctor)
    ) {
      this.logger.warn(`Rejected junk assignedDoctor: "${next.assignedDoctor}"`);
      next.assignedDoctor = null;
      next.assignedDoctorConfidence = 0;
    }

    if (!this.hasText(next.sourceContact)) {
      const sourceFromText = this.detectSourceContact(ocrText);
      if (sourceFromText) {
        next.sourceContact = sourceFromText;
        next.sourceContactConfidence = Math.max(
          next.sourceContactConfidence,
          0.6,
        );
      } else if (registrationForm) {
        next.sourceContact = 'Practice Intake Form';
        next.sourceContactConfidence = Math.max(
          next.sourceContactConfidence,
          0.35,
        );
      }
    }

    if (!this.hasText(next.assignedDoctor)) {
      const doctorFromText = this.detectAssignedDoctor(ocrText);
      if (doctorFromText) {
        next.assignedDoctor = doctorFromText;
        next.assignedDoctorConfidence = Math.max(
          next.assignedDoctorConfidence,
          0.55,
        );
      } else if (
        registrationForm &&
        this.hasText(next.sourceContact) &&
        this.looksLikeDoctorName(next.sourceContact)
      ) {
        // Keep intake forms complete while signaling low certainty for receptionist review.
        next.assignedDoctor = next.sourceContact;
        next.assignedDoctorConfidence = Math.max(
          next.assignedDoctorConfidence,
          0.3,
        );
      }
    }

    // Final post-fallback guard so heuristics never persist junk values.
    if (
      this.hasText(next.sourceContact) &&
      !this.looksLikeSourceContact(next.sourceContact)
    ) {
      this.logger.warn(
        `Post-fallback rejected sourceContact: "${next.sourceContact}"`,
      );
      next.sourceContact = null;
      next.sourceContactConfidence = 0;
    }
    if (
      this.hasText(next.assignedDoctor) &&
      !this.looksLikeDoctorName(next.assignedDoctor)
    ) {
      this.logger.warn(
        `Post-fallback rejected assignedDoctor: "${next.assignedDoctor}"`,
      );
      next.assignedDoctor = null;
      next.assignedDoctorConfidence = 0;
    }

    return next;
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

      // Fill defaults for optional fields if AI didn't return them
      parsed.patientDob = parsed.patientDob || null;
      parsed.patientDobConfidence = parsed.patientDobConfidence ?? 0;
      parsed.patientId = parsed.patientId || null;
      parsed.patientIdConfidence = parsed.patientIdConfidence ?? 0;
      parsed.specialist = parsed.specialist || null;
      parsed.specialistConfidence = parsed.specialistConfidence ?? 0;
      parsed.facility = parsed.facility || null;
      parsed.facilityConfidence = parsed.facilityConfidence ?? 0;
      parsed.urgency = parsed.urgency || 'Normal';
      parsed.urgencyConfidence = parsed.urgencyConfidence ?? 0.5;
      parsed.summary = parsed.summary || null;
      parsed.summaryConfidence = parsed.summaryConfidence ?? 0;

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
    if (
      data.storeIn !== 'Investigations' &&
      data.storeIn !== 'Correspondence'
    ) {
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
