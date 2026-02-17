-- Category-triggered workflow metadata for review routing
ALTER TABLE extracted_data
  ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(80) DEFAULT 'standard_correspondence_review',
  ADD COLUMN IF NOT EXISTS requires_doctor_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS workflow_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_extracted_data_workflow_type
  ON extracted_data(workflow_type);

CREATE INDEX IF NOT EXISTS idx_extracted_data_requires_doctor_review
  ON extracted_data(requires_doctor_review);
