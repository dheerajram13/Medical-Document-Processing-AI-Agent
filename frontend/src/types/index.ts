// Document types
export interface Document {
  id: string;
  file_name: string;
  file_path: string;
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
  raw_extraction?: any;
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
  };
  extractedData: Partial<ExtractedData>;
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
  'Admission summary',
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
