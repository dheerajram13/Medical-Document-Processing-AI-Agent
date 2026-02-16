import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OcrService } from '../ocr/ocr.service';
import { ExtractionService } from '../extraction/extraction.service';

type ExtractedLookupColumn = 'patient_name' | 'source_contact' | 'assigned_doctor';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private supabase: SupabaseClient;

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
  async processDocument(
    file: Express.Multer.File,
  ): Promise<{
    documentId: string;
    ocrResult: any;
    extractedData: any;
    aiExtractionFailed?: boolean;
    aiErrorMessage?: string;
  }> {
    this.logger.log(`Starting document processing: ${file.originalname}`);

    try {
      // Step 1: Upload file to Supabase Storage
      const filePath = await this.uploadFileToStorage(file);
      this.logger.log(`File uploaded to storage: ${filePath}`);

      // Step 2: Create document record
      const documentId = await this.createDocumentRecord({
        fileName: file.originalname,
        filePath: filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: 'processing',
      });
      this.logger.log(`Document record created: ${documentId}`);

      // Step 3: Run OCR extraction
      this.logger.log('Running OCR extraction...');
      let ocrResult;
      try {
        ocrResult = await this.ocrService.extractText(
          file.buffer,
          file.mimetype,
        );
        this.logger.log(
          `OCR completed: ${ocrResult.pages} pages, ${ocrResult.confidence * 100}% confidence`,
        );
      } catch (error) {
        this.logger.error(`Azure OCR failed: ${error.message}`);
        throw new Error(`Azure OCR extraction failed: ${error.message}`);
      }

      // Step 4: Run AI field extraction (with graceful degradation)
      this.logger.log('Running AI field extraction...');
      let aiResult;
      let aiExtractionFailed = false;
      let aiErrorMessage = '';

      try {
        aiResult = await this.extractionService.extractMedicalFields(
          ocrResult.text,
        );
        this.logger.log(
          `AI extraction completed: ${aiResult.extractedFields.patientName}`,
        );
      } catch (error) {
        aiExtractionFailed = true;
        aiErrorMessage = error.message;
        this.logger.warn(`AI extraction failed: ${error.message}. Document will be saved with OCR data only for manual review.`);

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
          },
          rawResponse: {
            provider: 'none',
            error: aiErrorMessage,
            fallbackReason: 'AI extraction failed, manual review required',
          },
        };
      }

      // Step 5: Save extracted data to database
      const extractedDataId = await this.saveExtractedData(
        documentId,
        ocrResult,
        aiResult,
      );
      this.logger.log(`Extracted data saved: ${extractedDataId}`);

      // Step 6: Update document status to 'review'
      await this.updateDocumentStatus(documentId, 'review');
      this.logger.log('Document status updated to review');

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
  private async saveExtractedData(
    documentId: string,
    ocrResult: any,
    aiResult: any,
  ): Promise<string> {
    const fields = aiResult.extractedFields;

    const { data, error } = await this.supabase
      .from('extracted_data')
      .insert({
        document_id: documentId,
        patient_name: fields.patientName,
        patient_name_confidence: fields.patientNameConfidence,
        report_date: fields.reportDate,
        report_date_confidence: fields.reportDateConfidence,
        subject: fields.subject,
        subject_confidence: fields.subjectConfidence,
        source_contact: fields.sourceContact,
        source_contact_confidence: fields.sourceContactConfidence,
        store_in: fields.storeIn,
        store_in_confidence: fields.storeInConfidence,
        assigned_doctor: fields.assignedDoctor,
        assigned_doctor_confidence: fields.assignedDoctorConfidence,
        category: fields.category,
        category_confidence: fields.categoryConfidence,
        raw_extraction: aiResult.rawResponse,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save extracted data: ${error.message}`);
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

    const fileSignedUrl = await this.createSignedFileUrl(data.file_path);

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

    // Build update object with snake_case field names
    const updateData: any = {};
    if (updates.patientName !== undefined) {
      updateData.patient_name = updates.patientName;
      updateData.patient_name_confidence = 1.0; // User verified
    }
    if (updates.reportDate !== undefined) {
      updateData.report_date = updates.reportDate;
      updateData.report_date_confidence = 1.0;
    }
    if (updates.subject !== undefined) {
      updateData.subject = updates.subject;
      updateData.subject_confidence = 1.0;
    }
    if (updates.sourceContact !== undefined) {
      updateData.source_contact = updates.sourceContact;
      updateData.source_contact_confidence = 1.0;
    }
    if (updates.storeIn !== undefined) {
      updateData.store_in = updates.storeIn;
      updateData.store_in_confidence = 1.0;
    }
    if (updates.assignedDoctor !== undefined) {
      updateData.assigned_doctor = updates.assignedDoctor;
      updateData.assigned_doctor_confidence = 1.0;
    }
    if (updates.category !== undefined) {
      updateData.category = updates.category;
      updateData.category_confidence = 1.0;
    }

    const { error } = await this.supabase
      .from('extracted_data')
      .update(updateData)
      .eq('document_id', documentId);

    if (error) {
      throw new Error(`Failed to update extracted data: ${error.message}`);
    }

    this.logger.log('Extracted data updated successfully');
  }

  /**
   * Approve document (mark as completed)
   */
  async approveDocument(documentId: string): Promise<void> {
    this.logger.log(`Approving document: ${documentId}`);

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
    const fromPatientsTable = await this.getLookupFromTable('patients', 'full_name', query);
    if (fromPatientsTable.length > 0) {
      return fromPatientsTable;
    }

    return this.getLookupFromExtractedData('patient_name', query);
  }

  async getDoctorLookup(query = ''): Promise<string[]> {
    const fromDoctorsTable = await this.getLookupFromTable('doctors', 'full_name', query, true);
    if (fromDoctorsTable.length > 0) {
      return fromDoctorsTable;
    }

    return this.getLookupFromExtractedData('assigned_doctor', query);
  }

  async getSourceContactLookup(query = ''): Promise<string[]> {
    const fromSourceContactsTable = await this.getLookupFromTable('source_contacts', 'name', query);
    if (fromSourceContactsTable.length > 0) {
      return fromSourceContactsTable;
    }

    return this.getLookupFromExtractedData('source_contact', query);
  }

  /**
   * Reject document (mark as failed)
   */
  async rejectDocument(
    documentId: string,
    reason?: string,
  ): Promise<void> {
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
      if (error.code === 'PGRST205' || /does not exist|relation/i.test(error.message)) {
        this.logger.warn(`Lookup table unavailable (${tableName}), falling back to extracted_data.`);
        return [];
      }
      throw new Error(`Failed lookup on ${tableName}.${column}: ${error.message}`);
    }

    const rows = Array.isArray(data)
      ? (data as unknown as Array<Record<string, unknown>>)
      : [];

    return this.normalizeLookupValues(
      rows.map((row) => (typeof row[column] === 'string' ? (row[column] as string) : null)),
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
      rows.map((row) => (typeof row[column] === 'string' ? (row[column] as string) : null)),
    ).slice(0, 20);
  }

  private normalizeLookupValues(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    for (const rawValue of values) {
      const value = rawValue?.trim();
      if (!value) {
        continue;
      }
      seen.add(value);
    }

    return Array.from(seen).sort((a, b) => a.localeCompare(b));
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
