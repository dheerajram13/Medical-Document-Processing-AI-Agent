import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OcrService } from '../ocr/ocr.service';
import { ExtractionService } from '../extraction/extraction.service';

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
      const ocrResult = await this.ocrService.extractText(
        file.buffer,
        file.mimetype,
      );
      this.logger.log(
        `OCR completed: ${ocrResult.pages} pages, ${ocrResult.confidence * 100}% confidence`,
      );

      // Step 4: Run AI field extraction
      this.logger.log('Running AI field extraction...');
      const aiResult = await this.extractionService.extractMedicalFields(
        ocrResult.text,
      );
      this.logger.log(
        `AI extraction completed: ${aiResult.extractedFields.patientName}`,
      );

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

    return data;
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
   * Approve document (mark as completed, ready for PMS import)
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
}
