-- Extend extracted_data to match backend extraction payload
ALTER TABLE extracted_data
  ADD COLUMN IF NOT EXISTS patient_dob DATE,
  ADD COLUMN IF NOT EXISTS patient_dob_confidence FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS patient_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS patient_id_confidence FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specialist VARCHAR(255),
  ADD COLUMN IF NOT EXISTS specialist_confidence FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS facility VARCHAR(255),
  ADD COLUMN IF NOT EXISTS facility_confidence FLOAT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS urgency VARCHAR(50) DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS urgency_confidence FLOAT DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_confidence FLOAT DEFAULT 0;

-- Optional lookup tables used by review form typeahead APIs.
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_data_patient_name
  ON extracted_data(patient_name);
CREATE INDEX IF NOT EXISTS idx_extracted_data_source_contact
  ON extracted_data(source_contact);
CREATE INDEX IF NOT EXISTS idx_extracted_data_assigned_doctor
  ON extracted_data(assigned_doctor);

CREATE INDEX IF NOT EXISTS idx_patients_full_name
  ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_doctors_full_name
  ON doctors(full_name);
CREATE INDEX IF NOT EXISTS idx_doctors_active
  ON doctors(active);
CREATE INDEX IF NOT EXISTS idx_source_contacts_name
  ON source_contacts(name);
