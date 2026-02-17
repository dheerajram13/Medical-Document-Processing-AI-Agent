import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OcrService } from '../ocr/ocr.service';
import {
  ExtractionService,
  type ExtractedFields,
} from '../extraction/extraction.service';

type ExtractedLookupColumn =
  | 'patient_name'
  | 'source_contact'
  | 'assigned_doctor';

type OcrResult = {
  text: string;
  pages: number;
  confidence: number;
  metadata?: unknown;
};

type StoreIn = 'Investigations' | 'Correspondence';

type WorkflowType =
  | 'doctor_review_investigations'
  | 'standard_correspondence_review';

type AiExtractionResult = {
  extractedFields: ExtractedFields;
  rawResponse: unknown;
};

type ExtractedDataSnapshot = {
  id: string;
  document_id: string;
  patient_name: string | null;
  report_date: string | null;
  subject: string | null;
  source_contact: string | null;
  store_in: StoreIn | null;
  store_in_confidence: number | null;
  assigned_doctor: string | null;
  category: string | null;
  workflow_type: WorkflowType | null;
  requires_doctor_review: boolean | null;
  workflow_reason: string | null;
  created_at: string;
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

const INVESTIGATION_CATEGORIES = new Set<string>([
  'Medical imaging report',
  'Pathology results',
  'ECG',
]);

const CATEGORY_CANONICAL_MAP = new Map(
  DOCUMENT_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

const LOOKUP_JUNK_PATTERN =
  /\b(consent|privacy|confidential|legislation|do you|please|enter|select|tick|same as|relationship to|phone number|address|gender|date of birth|new patient form|personal details information sheet|intake form)\b/i;
const LOOKUP_PLACEHOLDER_PATTERN =
  /^(not specified|n\/?a|unknown|gp|none|null|undefined|as above)$/i;
const ORGANISATION_HINT_PATTERN =
  /\b(clinic|hospital|radiology|imaging|pathology|medical|centre|center|practice|laboratory|lab|health|specialist|diagnostic|surgery)\b/i;
const NAME_TOKEN_PATTERN = /^[A-Za-z][A-Za-z'.-]*$/;
const DOCTOR_PREFIX_PATTERN = /^(dr\.?|doctor)$/i;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private supabase: SupabaseClient;
  private workflowColumnsAvailable: boolean | null = null;

  constructor(
    private configService: ConfigService,
    private ocrService: OcrService,
    private extractionService: ExtractionService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration not found');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.log('Supabase client initialized');
  }

  /**
   * Complete document processing pipeline:
   * 1. Upload file to Supabase Storage
   * 2. Create document record in database
   * 3. Run OCR extraction
   * 4. Run AI field extraction
   * 5. Save extracted data to database
   * 6. Update document status
   */
  async processDocument(file: Express.Multer.File): Promise<{
    documentId: string;
    ocrResult: OcrResult;
    extractedData: ExtractedFields;
    aiExtractionFailed?: boolean;
    aiErrorMessage?: string;
  }> {
    this.logger.log(`Starting document processing: ${file.originalname}`);
    const pipelineStartedAt = Date.now();
    const timing: Record<string, number> = {
      uploadMs: 0,
      createRecordMs: 0,
      ocrMs: 0,
      aiMs: 0,
      saveMs: 0,
      statusMs: 0,
    };

    try {
      // Step 1: Upload file to Supabase Storage
      let stageStartedAt = Date.now();
      const filePath = await this.uploadFileToStorage(file);
      timing.uploadMs = Date.now() - stageStartedAt;
      this.logger.log(`File uploaded to storage: ${filePath}`);

      // Step 2: Create document record
      stageStartedAt = Date.now();
      const documentId = await this.createDocumentRecord({
        fileName: file.originalname,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'processing',
      });
      timing.createRecordMs = Date.now() - stageStartedAt;
      this.logger.log(`Document record created: ${documentId}`);

      // Step 3: Run OCR extraction
      this.logger.log('Running OCR extraction...');
      let ocrResult: OcrResult;
      try {
        stageStartedAt = Date.now();
        ocrResult = await this.ocrService.extractText(
          file.buffer,
          file.mimetype,
          {
            includeMetadata: false,
          },
        );
        timing.ocrMs = Date.now() - stageStartedAt;
        this.logger.log(
          `OCR completed: ${ocrResult.pages} pages, ${ocrResult.confidence * 100}% confidence`,
        );
      } catch (error) {
        this.logger.error(`Azure OCR failed: ${error.message}`);
        throw new Error(`Azure OCR extraction failed: ${error.message}`);
      }

      // Step 4: Run AI field extraction (with graceful degradation)
      this.logger.log('Running AI field extraction...');
      let aiResult: AiExtractionResult;
      let aiExtractionFailed = false;
      let aiErrorMessage = '';

      try {
        stageStartedAt = Date.now();
        aiResult = await this.extractionService.extractMedicalFields(
          ocrResult.text,
          { fileName: file.originalname },
        );
        timing.aiMs = Date.now() - stageStartedAt;
        this.logger.log(
          `AI extraction completed: ${aiResult.extractedFields.patientName}`,
        );
      } catch (error) {
        timing.aiMs = Date.now() - stageStartedAt;
        aiExtractionFailed = true;
        aiErrorMessage = error.message;
        this.logger.warn(
          `AI extraction failed: ${error.message}. Document will be saved with OCR data only for manual review.`,
        );

        // Create empty extracted fields for manual entry
        aiResult = {
          extractedFields: {
            patientName: null,
            patientNameConfidence: 0,
            reportDate: null,
            reportDateConfidence: 0,
            subject: 'Manual Review Required',
            subjectConfidence: 0,
            sourceContact: null,
            sourceContactConfidence: 0,
            storeIn: 'Investigations',
            storeInConfidence: 0,
            assignedDoctor: null,
            assignedDoctorConfidence: 0,
            category: 'Uncategorized',
            categoryConfidence: 0,
            patientDob: null,
            patientDobConfidence: 0,
            patientId: null,
            patientIdConfidence: 0,
            specialist: null,
            specialistConfidence: 0,
            facility: null,
            facilityConfidence: 0,
            urgency: 'Normal',
            urgencyConfidence: 0,
            summary: null,
            summaryConfidence: 0,
          },
          rawResponse: {
            provider: 'none',
            error: aiErrorMessage,
            fallbackReason: 'AI extraction failed, manual review required',
          },
        };
      }

      // Step 5: Save extracted data to database
      stageStartedAt = Date.now();
      const extractedDataId = await this.saveExtractedData(
        documentId,
        aiResult,
      );
      timing.saveMs = Date.now() - stageStartedAt;
      this.logger.log(`Extracted data saved: ${extractedDataId}`);

      // Step 6: Update document status to 'review'
      stageStartedAt = Date.now();
      await this.updateDocumentStatus(documentId, 'review');
      timing.statusMs = Date.now() - stageStartedAt;
      this.logger.log('Document status updated to review');
      this.logger.log(
        `Processing timing (ms): upload=${timing.uploadMs}, create=${timing.createRecordMs}, ocr=${timing.ocrMs}, ai=${timing.aiMs}, save=${timing.saveMs}, status=${timing.statusMs}, total=${Date.now() - pipelineStartedAt}`,
      );

      return {
        documentId,
        ocrResult: {
          text: ocrResult.text,
          pages: ocrResult.pages,
          confidence: ocrResult.confidence,
        },
        extractedData: aiResult.extractedFields,
        aiExtractionFailed,
        aiErrorMessage: aiExtractionFailed ? aiErrorMessage : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Document processing failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  private async uploadFileToStorage(
    file: Express.Multer.File,
  ): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.originalname}`;
    const filePath = `documents/${fileName}`;

    const { data, error } = await this.supabase.storage
      .from('documents')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    return data.path;
  }

  /**
   * Create document record in database
   */
  private async createDocumentRecord(documentData: {
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    status: string;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('documents')
      .insert({
        file_name: documentData.fileName,
        file_path: documentData.filePath,
        file_size: documentData.fileSize,
        mime_type: documentData.mimeType,
        status: documentData.status,
        uploaded_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create document record: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Save extracted data to database
   */
  /**
   * Validate a date string is a real date (e.g. reject 2022-02-30)
   */
  private sanitizeDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (!match) return null;
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    // Verify the date round-trips (catches things like Feb 30)
    if (d.toISOString().slice(0, 10) !== dateStr) return null;
    return dateStr;
  }

  private normalizeOptionalText(
    value: string | null | undefined,
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCategory(value: string | null | undefined): string | null {
    const normalized = this.normalizeOptionalText(value);
    if (!normalized) {
      return null;
    }
    return CATEGORY_CANONICAL_MAP.get(normalized.toLowerCase()) ?? null;
  }

  private isStoreIn(value: string | null | undefined): value is StoreIn {
    return value === 'Investigations' || value === 'Correspondence';
  }

  private deriveWorkflow(
    categoryInput: string | null | undefined,
    storeInInput: string | null | undefined,
  ): {
    category: string | null;
    storeIn: StoreIn;
    workflowType: WorkflowType;
    requiresDoctorReview: boolean;
    workflowReason: string;
  } {
    const category = this.normalizeCategory(categoryInput);
    const requestedStoreIn = this.isStoreIn(storeInInput)
      ? storeInInput
      : undefined;

    if (category && INVESTIGATION_CATEGORIES.has(category)) {
      return {
        category,
        storeIn: 'Investigations',
        workflowType: 'doctor_review_investigations',
        requiresDoctorReview: true,
        workflowReason: `Category "${category}" routes to investigations doctor review.`,
      };
    }

    const finalStoreIn = requestedStoreIn ?? 'Correspondence';
    const requiresDoctorReview = finalStoreIn === 'Investigations';
    return {
      category,
      storeIn: finalStoreIn,
      workflowType: requiresDoctorReview
        ? 'doctor_review_investigations'
        : 'standard_correspondence_review',
      requiresDoctorReview,
      workflowReason: requiresDoctorReview
        ? 'Store In set to Investigations.'
        : 'Standard correspondence workflow.',
    };
  }

  private shouldUseWorkflowColumns(): boolean {
    return this.workflowColumnsAvailable !== false;
  }

  private isWorkflowColumnError(
    error: { message?: string } | null | undefined,
  ): boolean {
    if (!error?.message) {
      return false;
    }

    const message = error.message.toLowerCase();
    const mentionsWorkflowColumn =
      message.includes('workflow_type') ||
      message.includes('requires_doctor_review') ||
      message.includes('workflow_reason');
    const isColumnOrSchemaError =
      message.includes('schema cache') ||
      message.includes('column') ||
      message.includes('does not exist');
    return mentionsWorkflowColumn && isColumnOrSchemaError;
  }

  private stripWorkflowFields(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const next = { ...payload };
    delete next.workflow_type;
    delete next.requires_doctor_review;
    delete next.workflow_reason;
    return next;
  }

  private async updateExtractedDataRow(
    documentId: string,
    payload: Record<string, unknown>,
    context: string,
  ): Promise<void> {
    const hasWorkflowFields =
      Object.hasOwn(payload, 'workflow_type') ||
      Object.hasOwn(payload, 'requires_doctor_review') ||
      Object.hasOwn(payload, 'workflow_reason');
    const attemptWorkflowColumns =
      hasWorkflowFields && this.shouldUseWorkflowColumns();

    let updatePayload = attemptWorkflowColumns
      ? payload
      : this.stripWorkflowFields(payload);

    if (Object.keys(updatePayload).length === 0) {
      return;
    }

    let { error } = await this.supabase
      .from('extracted_data')
      .update(updatePayload)
      .eq('document_id', documentId);

    if (error && attemptWorkflowColumns && this.isWorkflowColumnError(error)) {
      this.workflowColumnsAvailable = false;
      this.logger.warn(
        'Workflow columns are missing in extracted_data. Apply migration 003_review_workflow_fields.sql to enable workflow metadata.',
      );

      updatePayload = this.stripWorkflowFields(payload);
      if (Object.keys(updatePayload).length === 0) {
        return;
      }

      ({ error } = await this.supabase
        .from('extracted_data')
        .update(updatePayload)
        .eq('document_id', documentId));
    } else if (!error && attemptWorkflowColumns) {
      this.workflowColumnsAvailable = true;
    }

    if (error) {
      throw new Error(`Failed to ${context}: ${error.message}`);
    }
  }

  private async getExtractedDataSnapshot(
    documentId: string,
  ): Promise<ExtractedDataSnapshot> {
    const baseSelect =
      'id,document_id,patient_name,report_date,subject,source_contact,store_in,store_in_confidence,assigned_doctor,category,created_at';
    const workflowSelect =
      'id,document_id,patient_name,report_date,subject,source_contact,store_in,store_in_confidence,assigned_doctor,category,workflow_type,requires_doctor_review,workflow_reason,created_at';

    const selectWithWorkflow = this.shouldUseWorkflowColumns();

    let { data, error } = await this.supabase
      .from('extracted_data')
      .select(selectWithWorkflow ? workflowSelect : baseSelect)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && selectWithWorkflow && this.isWorkflowColumnError(error)) {
      this.workflowColumnsAvailable = false;
      this.logger.warn(
        'Workflow columns are missing in extracted_data. Apply migration 003_review_workflow_fields.sql to enable workflow metadata.',
      );

      ({ data, error } = await this.supabase
        .from('extracted_data')
        .select(baseSelect)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    } else if (!error && selectWithWorkflow) {
      this.workflowColumnsAvailable = true;
    }

    if (error) {
      throw new Error(`Failed to load extracted data: ${error.message}`);
    }

    if (!data) {
      throw new Error(
        `Extracted data not found for document ${documentId}. Process the document first.`,
      );
    }

    const row = data as unknown as Record<string, unknown>;

    return {
      ...(data as unknown as ExtractedDataSnapshot),
      workflow_type:
        typeof row.workflow_type === 'string'
          ? (row.workflow_type as WorkflowType)
          : null,
      requires_doctor_review:
        typeof row.requires_doctor_review === 'boolean'
          ? row.requires_doctor_review
          : null,
      workflow_reason:
        typeof row.workflow_reason === 'string' ? row.workflow_reason : null,
    };
  }

  private ensureRequiredSevenFields(snapshot: ExtractedDataSnapshot): void {
    const requiredFields = [
      ['patient_name', snapshot.patient_name],
      ['report_date', snapshot.report_date],
      ['subject', snapshot.subject],
      ['source_contact', snapshot.source_contact],
      ['store_in', snapshot.store_in],
      ['assigned_doctor', snapshot.assigned_doctor],
      ['category', snapshot.category],
    ] as const;

    for (const [field, value] of requiredFields) {
      const normalized = this.normalizeOptionalText(
        typeof value === 'string' ? value : null,
      );
      if (
        !normalized &&
        value !== 'Investigations' &&
        value !== 'Correspondence'
      ) {
        throw new Error(`Cannot approve: "${field}" is missing.`);
      }
    }

    if (!this.sanitizeDate(snapshot.report_date)) {
      throw new Error(
        'Cannot approve: report_date must be a valid YYYY-MM-DD.',
      );
    }

    if (!this.isStoreIn(snapshot.store_in)) {
      throw new Error(
        'Cannot approve: store_in must be Investigations or Correspondence.',
      );
    }

    if (!this.normalizeCategory(snapshot.category)) {
      throw new Error(
        'Cannot approve: category must be one of the allowed filing categories.',
      );
    }
  }

  private hasLookupMatch(value: string, options: string[]): boolean {
    return options.some(
      (option) => option.trim().toLowerCase() === value.trim().toLowerCase(),
    );
  }

  private async validateLookupBackedField(
    label: 'Patient Name' | 'Source Contact' | 'Assigned Doctor',
    value: string | null | undefined,
  ): Promise<void> {
    const normalized = this.normalizeOptionalText(value);
    if (!normalized) {
      return;
    }

    const options =
      label === 'Patient Name'
        ? await this.getPatientLookup(normalized)
        : label === 'Source Contact'
          ? await this.getSourceContactLookup(normalized)
          : await this.getDoctorLookup(normalized);

    if (options.length === 0) {
      throw new Error(
        `${label} "${normalized}" is not selectable. Seed lookup values first.`,
      );
    }

    if (!this.hasLookupMatch(normalized, options)) {
      throw new Error(
        `${label} "${normalized}" must be selected from lookup values.`,
      );
    }
  }

  private async saveExtractedData(
    documentId: string,
    aiResult: AiExtractionResult,
  ): Promise<string> {
    const fields = aiResult.extractedFields;
    const workflow = this.deriveWorkflow(fields.category, fields.storeIn);
    fields.category = workflow.category;
    fields.storeIn = workflow.storeIn;

    const baseInsertPayload: Record<string, unknown> = {
      document_id: documentId,
      patient_name: fields.patientName,
      patient_name_confidence: fields.patientNameConfidence,
      report_date: this.sanitizeDate(fields.reportDate),
      report_date_confidence: fields.reportDateConfidence,
      subject: fields.subject,
      subject_confidence: fields.subjectConfidence,
      source_contact: fields.sourceContact,
      source_contact_confidence: fields.sourceContactConfidence,
      store_in: workflow.storeIn,
      store_in_confidence: fields.storeInConfidence,
      assigned_doctor: fields.assignedDoctor,
      assigned_doctor_confidence: fields.assignedDoctorConfidence,
      category: workflow.category,
      category_confidence: workflow.category ? fields.categoryConfidence : 0,
      patient_dob: this.sanitizeDate(fields.patientDob),
      patient_dob_confidence: fields.patientDobConfidence ?? 0,
      patient_id: fields.patientId ?? null,
      patient_id_confidence: fields.patientIdConfidence ?? 0,
      specialist: fields.specialist ?? null,
      specialist_confidence: fields.specialistConfidence ?? 0,
      facility: fields.facility ?? null,
      facility_confidence: fields.facilityConfidence ?? 0,
      urgency: fields.urgency ?? 'Normal',
      urgency_confidence: fields.urgencyConfidence ?? 0.5,
      summary: fields.summary ?? null,
      summary_confidence: fields.summaryConfidence ?? 0,
      raw_extraction: aiResult.rawResponse,
    };

    const insertPayloadWithWorkflow: Record<string, unknown> = {
      ...baseInsertPayload,
      workflow_type: workflow.workflowType,
      requires_doctor_review: workflow.requiresDoctorReview,
      workflow_reason: workflow.workflowReason,
    };

    const attemptWorkflowColumns = this.shouldUseWorkflowColumns();
    let payload = attemptWorkflowColumns
      ? insertPayloadWithWorkflow
      : baseInsertPayload;

    let { data, error } = await this.supabase
      .from('extracted_data')
      .insert(payload)
      .select('id')
      .single();

    if (error && attemptWorkflowColumns && this.isWorkflowColumnError(error)) {
      this.workflowColumnsAvailable = false;
      this.logger.warn(
        'Workflow columns are missing in extracted_data. Apply migration 003_review_workflow_fields.sql to enable workflow metadata.',
      );

      payload = baseInsertPayload;
      ({ data, error } = await this.supabase
        .from('extracted_data')
        .insert(payload)
        .select('id')
        .single());
    } else if (!error && attemptWorkflowColumns) {
      this.workflowColumnsAvailable = true;
    }

    if (error) {
      throw new Error(`Failed to save extracted data: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to save extracted data: no id returned.');
    }

    return data.id;
  }

  /**
   * Update document status
   */
  private async updateDocumentStatus(
    documentId: string,
    status: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('documents')
      .update({
        status: status,
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to update document status: ${error.message}`);
    }
  }

  /**
   * Get document with extracted data
   */
  async getDocument(documentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('documents')
      .select(
        `
        *,
        extracted_data (*)
      `,
      )
      .eq('id', documentId)
      .single();

    if (error) {
      throw new Error(`Failed to get document: ${error.message}`);
    }

    const fileSignedUrl = await this.createSignedFileUrl(
      String(data.file_path),
    );

    return {
      ...data,
      file_signed_url: fileSignedUrl,
    };
  }

  /**
   * Get all documents in review queue
   */
  async getReviewQueue(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('documents')
      .select(
        `
        *,
        extracted_data (*)
      `,
      )
      .eq('status', 'review')
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get review queue: ${error.message}`);
    }

    return data;
  }

  /**
   * Update extracted data (when user corrects fields)
   */
  async updateExtractedData(
    documentId: string,
    updates: {
      patientName?: string;
      reportDate?: string;
      subject?: string;
      sourceContact?: string;
      storeIn?: 'Investigations' | 'Correspondence';
      assignedDoctor?: string;
      category?: string;
    },
  ): Promise<void> {
    this.logger.log(`Updating extracted data for document: ${documentId}`);
    const current = await this.getExtractedDataSnapshot(documentId);
    const updateData: Record<string, unknown> = {};

    if (updates.patientName !== undefined) {
      const normalized = this.normalizeOptionalText(updates.patientName);
      await this.validateLookupBackedField('Patient Name', normalized);
      updateData.patient_name = normalized;
      updateData.patient_name_confidence = 1.0; // User verified
    }

    if (updates.reportDate !== undefined) {
      const normalized = this.normalizeOptionalText(updates.reportDate);
      const sanitized = this.sanitizeDate(normalized);
      if (normalized && !sanitized) {
        throw new Error('Report Date must be a valid YYYY-MM-DD date.');
      }
      updateData.report_date = sanitized;
      updateData.report_date_confidence = 1.0;
    }

    if (updates.subject !== undefined) {
      updateData.subject = this.normalizeOptionalText(updates.subject);
      updateData.subject_confidence = 1.0;
    }

    if (updates.sourceContact !== undefined) {
      const normalized = this.normalizeOptionalText(updates.sourceContact);
      await this.validateLookupBackedField('Source Contact', normalized);
      updateData.source_contact = normalized;
      updateData.source_contact_confidence = 1.0;
    }

    if (updates.assignedDoctor !== undefined) {
      const normalized = this.normalizeOptionalText(updates.assignedDoctor);
      await this.validateLookupBackedField('Assigned Doctor', normalized);
      updateData.assigned_doctor = normalized;
      updateData.assigned_doctor_confidence = 1.0;
    }

    const requestedCategory =
      updates.category !== undefined
        ? this.normalizeOptionalText(updates.category)
        : undefined;
    if (requestedCategory !== undefined && requestedCategory !== null) {
      const normalizedCategory = this.normalizeCategory(requestedCategory);
      if (!normalizedCategory) {
        throw new Error('Category must be selected from the allowed list.');
      }
      updateData.category = normalizedCategory;
      updateData.category_confidence = 1.0;
    }
    if (requestedCategory === null) {
      updateData.category = null;
      updateData.category_confidence = 0;
    }

    if (updates.storeIn !== undefined && !this.isStoreIn(updates.storeIn)) {
      throw new Error('Store In must be Investigations or Correspondence.');
    }

    const nextCategory =
      requestedCategory !== undefined
        ? this.normalizeCategory(requestedCategory)
        : current.category;
    const nextStoreInInput =
      updates.storeIn !== undefined ? updates.storeIn : current.store_in;
    const workflow = this.deriveWorkflow(nextCategory, nextStoreInInput);

    if (updates.storeIn !== undefined || updates.category !== undefined) {
      updateData.store_in = workflow.storeIn;
      updateData.store_in_confidence = 1.0;
      updateData.workflow_type = workflow.workflowType;
      updateData.requires_doctor_review = workflow.requiresDoctorReview;
      updateData.workflow_reason = workflow.workflowReason;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await this.updateExtractedDataRow(
      documentId,
      updateData,
      'update extracted data',
    );

    this.logger.log('Extracted data updated successfully');
  }

  /**
   * Approve document (mark as completed)
   */
  async approveDocument(documentId: string): Promise<void> {
    this.logger.log(`Approving document: ${documentId}`);

    const snapshot = await this.getExtractedDataSnapshot(documentId);
    this.ensureRequiredSevenFields(snapshot);
    await this.validateLookupBackedField('Patient Name', snapshot.patient_name);
    await this.validateLookupBackedField(
      'Source Contact',
      snapshot.source_contact,
    );
    await this.validateLookupBackedField(
      'Assigned Doctor',
      snapshot.assigned_doctor,
    );

    const workflow = this.deriveWorkflow(snapshot.category, snapshot.store_in);

    await this.updateExtractedDataRow(
      documentId,
      {
        category: workflow.category,
        store_in: workflow.storeIn,
        workflow_type: workflow.workflowType,
        requires_doctor_review: workflow.requiresDoctorReview,
        workflow_reason: workflow.workflowReason,
      },
      'finalize review workflow',
    );

    const { error } = await this.supabase
      .from('documents')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to approve document: ${error.message}`);
    }

    // Create audit log entry
    await this.createAuditLog(documentId, 'approved');

    this.logger.log('Document approved successfully');
  }

  /**
   * Lookup helpers for review form dropdown/search fields.
   */
  async getPatientLookup(query = ''): Promise<string[]> {
    const fromPatientsTable = await this.getLookupFromTable(
      'patients',
      'full_name',
      query,
    );
    if (fromPatientsTable.length > 0) {
      return fromPatientsTable;
    }

    return this.getLookupFromExtractedData('patient_name', query);
  }

  async getDoctorLookup(query = ''): Promise<string[]> {
    const fromDoctorsTable = await this.getLookupFromTable(
      'doctors',
      'full_name',
      query,
      true,
    );
    if (fromDoctorsTable.length > 0) {
      return fromDoctorsTable;
    }

    return this.getLookupFromExtractedData('assigned_doctor', query);
  }

  async getSourceContactLookup(query = ''): Promise<string[]> {
    const fromSourceContactsTable = await this.getLookupFromTable(
      'source_contacts',
      'name',
      query,
    );
    if (fromSourceContactsTable.length > 0) {
      return fromSourceContactsTable;
    }

    return this.getLookupFromExtractedData('source_contact', query);
  }

  /**
   * Reject document (mark as failed)
   */
  async rejectDocument(documentId: string, reason?: string): Promise<void> {
    this.logger.log(`Rejecting document: ${documentId}`);

    const { error } = await this.supabase
      .from('documents')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to reject document: ${error.message}`);
    }

    // Create audit log entry
    await this.createAuditLog(documentId, 'rejected', { reason });

    this.logger.log('Document rejected successfully');
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    documentId: string,
    action: string,
    details?: any,
  ): Promise<void> {
    const { error } = await this.supabase.from('audit_log').insert({
      document_id: documentId,
      action: action,
      details: details || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
      // Don't throw - audit log failure shouldn't break the main operation
    }
  }

  private async getLookupFromTable(
    tableName: 'patients' | 'doctors' | 'source_contacts',
    column: string,
    query: string,
    activeOnly = false,
  ): Promise<string[]> {
    let builder = this.supabase.from(tableName).select(column).limit(20);

    if (query) {
      builder = builder.ilike(column, `%${query}%`);
    }

    if (activeOnly) {
      builder = builder.eq('active', true);
    }

    const { data, error } = await builder;

    if (error) {
      // Some environments may not have these lookup tables yet.
      if (
        error.code === 'PGRST205' ||
        /does not exist|relation/i.test(error.message)
      ) {
        this.logger.warn(
          `Lookup table unavailable (${tableName}), falling back to extracted_data.`,
        );
        return [];
      }
      throw new Error(
        `Failed lookup on ${tableName}.${column}: ${error.message}`,
      );
    }

    const rows = Array.isArray(data)
      ? (data as unknown as Array<Record<string, unknown>>)
      : [];

    const lookupColumn: ExtractedLookupColumn =
      tableName === 'patients'
        ? 'patient_name'
        : tableName === 'doctors'
          ? 'assigned_doctor'
          : 'source_contact';

    return this.normalizeLookupValues(
      rows.map((row) => (typeof row[column] === 'string' ? row[column] : null)),
      lookupColumn,
    );
  }

  private async getLookupFromExtractedData(
    column: ExtractedLookupColumn,
    query: string,
  ): Promise<string[]> {
    let builder = this.supabase
      .from('extracted_data')
      .select(column)
      .not(column, 'is', null)
      .limit(200);

    if (query) {
      builder = builder.ilike(column, `%${query}%`);
    }

    const { data, error } = await builder;

    if (error) {
      throw new Error(`Failed fallback lookup for ${column}: ${error.message}`);
    }

    const rows = Array.isArray(data)
      ? (data as unknown as Array<Record<string, unknown>>)
      : [];

    return this.normalizeLookupValues(
      rows.map((row) => (typeof row[column] === 'string' ? row[column] : null)),
      column,
    ).slice(0, 20);
  }

  private normalizeLookupText(value: string): string {
    return value.replace(/\s+/g, ' ').replace(/[|]/g, '').trim();
  }

  private isLikelyPersonName(
    value: string,
    allowDoctorPrefix: boolean,
  ): boolean {
    let tokens = value.split(/\s+/).filter(Boolean);
    if (
      allowDoctorPrefix &&
      tokens.length > 1 &&
      DOCTOR_PREFIX_PATTERN.test(tokens[0])
    ) {
      tokens = tokens.slice(1);
    }

    if (tokens.length === 0 || tokens.length > 4) {
      return false;
    }
    if (tokens.some((token) => /[0-9]/.test(token))) {
      return false;
    }

    return tokens.every((token) => NAME_TOKEN_PATTERN.test(token));
  }

  private isLookupCandidate(
    value: string,
    column: ExtractedLookupColumn,
  ): boolean {
    if (value.length < 2 || value.length > 80) {
      return false;
    }
    if (/[?]/.test(value)) {
      return false;
    }
    if (LOOKUP_JUNK_PATTERN.test(value) || LOOKUP_PLACEHOLDER_PATTERN.test(value)) {
      return false;
    }

    if (column === 'patient_name') {
      if (ORGANISATION_HINT_PATTERN.test(value)) {
        return false;
      }
      return this.isLikelyPersonName(value, false);
    }

    if (column === 'assigned_doctor') {
      return this.isLikelyPersonName(value, true);
    }

    // source_contact: allow either person-like names or organisation names.
    if (this.isLikelyPersonName(value, true)) {
      return true;
    }

    const tokenCount = value.split(/\s+/).filter(Boolean).length;
    if (tokenCount === 0 || tokenCount > 8) {
      return false;
    }

    return (
      ORGANISATION_HINT_PATTERN.test(value) &&
      /^[A-Za-z0-9&'().,/\- ]+$/.test(value)
    );
  }

  private normalizeLookupCandidate(
    rawValue: string | null | undefined,
    column: ExtractedLookupColumn,
  ): string | null {
    if (typeof rawValue !== 'string') {
      return null;
    }

    const normalized = this.normalizeLookupText(rawValue);
    if (!normalized) {
      return null;
    }

    return this.isLookupCandidate(normalized, column) ? normalized : null;
  }

  private normalizeLookupValues(
    values: Array<string | null | undefined>,
    column: ExtractedLookupColumn,
  ): string[] {
    const seen = new Map<string, string>();
    for (const rawValue of values) {
      const value = this.normalizeLookupCandidate(rawValue, column);
      if (!value) {
        continue;
      }
      const key = value.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, value);
      }
    }

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Create a signed URL for files in the private "documents" storage bucket.
   * We support legacy and current file_path shapes to keep older records accessible.
   */
  private async createSignedFileUrl(filePath: string): Promise<string | null> {
    if (!filePath) {
      return null;
    }

    const normalizedPath = filePath.replace(/^\/+/, '');
    const candidates = Array.from(
      new Set([
        normalizedPath,
        normalizedPath.replace(/^documents\//, ''),
        normalizedPath.startsWith('documents/')
          ? normalizedPath
          : `documents/${normalizedPath}`,
      ]),
    );

    for (const pathCandidate of candidates) {
      if (!pathCandidate) {
        continue;
      }

      const { data, error } = await this.supabase.storage
        .from('documents')
        .createSignedUrl(pathCandidate, 60 * 60);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }

    this.logger.warn(`Unable to create signed URL for file path: ${filePath}`);
    return null;
  }
}
