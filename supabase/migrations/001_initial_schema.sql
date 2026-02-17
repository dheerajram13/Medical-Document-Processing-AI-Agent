-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, review, completed, failed
  uploaded_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Extracted data table
CREATE TABLE extracted_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  patient_name VARCHAR(255),
  patient_name_confidence FLOAT,
  report_date DATE,
  report_date_confidence FLOAT,
  subject TEXT,
  subject_confidence FLOAT,
  source_contact VARCHAR(255),
  source_contact_confidence FLOAT,
  store_in VARCHAR(50), -- Investigations, Correspondence
  store_in_confidence FLOAT,
  assigned_doctor VARCHAR(255),
  assigned_doctor_confidence FLOAT,
  category VARCHAR(100),
  category_confidence FLOAT,
  raw_extraction JSONB, -- Full AI response
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Review queue table
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  extracted_data_id UUID REFERENCES extracted_data(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, modified
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- document_uploaded, ocr_completed, extraction_completed, review_approved, etc.
  user_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at);
CREATE INDEX idx_extracted_data_document_id ON extracted_data(document_id);
CREATE INDEX idx_review_queue_status ON review_queue(status);
CREATE INDEX idx_audit_log_document_id ON audit_log(document_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extracted_data_updated_at BEFORE UPDATE ON extracted_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
