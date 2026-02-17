// Document types
export interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_signed_url?: string | null;
  file_size: number;
  mime_type: string;
  status: 'pending' | 'processing' | 'review' | 'completed' | 'failed';
  uploaded_at: string;
  processed_at?: string;
  created_by?: string;
  updated_at: string;
  extracted_data?: ExtractedData[];
}

// Extracted data from AI
export interface ExtractedData {
  id: string;
  document_id: string;
  // Core 7 fields
  patient_name: string | null;
  patient_name_confidence: number;
  report_date: string | null;
  report_date_confidence: number;
  subject: string | null;
  subject_confidence: number;
  source_contact: string | null;
  source_contact_confidence: number;
  store_in: 'Investigations' | 'Correspondence' | null;
  store_in_confidence: number;
  assigned_doctor: string | null;
  assigned_doctor_confidence: number;
  category: string | null;
  category_confidence: number;
  workflow_type: 'doctor_review_investigations' | 'standard_correspondence_review' | null;
  requires_doctor_review: boolean | null;
  workflow_reason: string | null;
  // Additional fields
  patient_dob: string | null;
  patient_dob_confidence: number;
  patient_id: string | null;
  patient_id_confidence: number;
  specialist: string | null;
  specialist_confidence: number;
  facility: string | null;
  facility_confidence: number;
  urgency: 'Normal' | 'Urgent' | 'Critical' | null;
  urgency_confidence: number;
  summary: string | null;
  summary_confidence: number;
  raw_extraction?: unknown;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  count?: number;
}

// Document processing result
export interface ProcessingResult {
  documentId: string;
  ocrResult: {
    text: string;
    pages: number;
    confidence: number;
    metadata?: OcrExtractionMetadata;
  };
  extractedData: Partial<ExtractedData>;
}

export interface OcrPoint {
  x: number;
  y: number;
}

export interface OcrLineLayout {
  content: string;
  polygon: OcrPoint[];
}

export interface OcrPageLayout {
  pageNumber: number;
  width: number | null;
  height: number | null;
  unit: string | null;
  lines: number;
  words: number;
  lineItems: OcrLineLayout[];
}

export interface OcrExtractionMetadata {
  model?: string;
  pages?: OcrPageLayout[];
}

export interface OcrExtractionResult {
  text: string;
  pages: number;
  confidence: number;
  metadata?: OcrExtractionMetadata;
}

// Update payload
export interface UpdateExtractedDataPayload {
  patientName?: string;
  reportDate?: string;
  subject?: string;
  sourceContact?: string;
  storeIn?: 'Investigations' | 'Correspondence';
  assignedDoctor?: string;
  category?: string;
}

// Document categories
export const DOCUMENT_CATEGORIES = [
  'Medical imaging report',
  'Pathology results',
  'Discharge summary',
  'Referral letter',
  'Letter',
  'ECG',
  'Certificate',
  'Allied health letter',
  'Immunisation',
  'Clinical notes',
  'Consent form',
  'Admissions summary',
  'Advance care planning',
  'Clinical photograph',
  'DAS21',
  'Email',
  'Form',
  'Indigenous PIP',
  'MyHealth registration',
  'New PT registration form',
  'Patient consent',
  'Record request',
  'Workcover',
  'Workcover consent',
] as const;

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];
