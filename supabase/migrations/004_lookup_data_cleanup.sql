-- Cleanup legacy polluted lookup-like values captured before strict validation.
-- Focused on Source Contact and Assigned Doctor values used by review lookups.

-- 1) Clear clearly invalid source_contact values from extracted_data fallback.
UPDATE extracted_data
SET
  source_contact = NULL,
  source_contact_confidence = 0
WHERE source_contact IS NOT NULL
  AND (
    length(trim(source_contact)) < 2
    OR length(trim(source_contact)) > 80
    OR trim(source_contact) ~* '\?'
    OR trim(source_contact) ~* '\b(consent|privacy|confidential|legislation|do you|please|enter|select|tick|same as|relationship to|phone number|address|gender|date of birth|new patient form|personal details information sheet|intake form)\b'
    OR trim(source_contact) ~* '^(not specified|n/?a|unknown|gp|none|null|undefined|as above)$'
  );

-- 2) Clear clearly invalid assigned_doctor values from extracted_data fallback.
UPDATE extracted_data
SET
  assigned_doctor = NULL,
  assigned_doctor_confidence = 0
WHERE assigned_doctor IS NOT NULL
  AND (
    length(trim(assigned_doctor)) < 2
    OR length(trim(assigned_doctor)) > 80
    OR trim(assigned_doctor) ~* '\?'
    OR trim(assigned_doctor) ~* '\b(consent|privacy|confidential|legislation|do you|please|enter|select|tick|same as|relationship to|phone number|address|gender|date of birth|new patient form|personal details information sheet|intake form)\b'
    OR trim(assigned_doctor) ~* '^(not specified|n/?a|unknown|gp|none|null|undefined|as above)$'
    OR trim(assigned_doctor) ~* '[0-9]'
    OR trim(assigned_doctor) !~* '^(dr\.?\s+|doctor\s+)?[a-z][a-z''.-]*(\s+[a-z][a-z''.-]*){0,3}$'
  );

-- 3) Remove clearly invalid lookup table rows if they were seeded from polluted data.
DELETE FROM source_contacts
WHERE
  length(trim(name)) < 2
  OR length(trim(name)) > 80
  OR trim(name) ~* '\?'
  OR trim(name) ~* '\b(consent|privacy|confidential|legislation|do you|please|enter|select|tick|same as|relationship to|phone number|address|gender|date of birth|new patient form|personal details information sheet|intake form)\b'
  OR trim(name) ~* '^(not specified|n/?a|unknown|gp|none|null|undefined|as above)$';

DELETE FROM doctors
WHERE
  length(trim(full_name)) < 2
  OR length(trim(full_name)) > 80
  OR trim(full_name) ~* '\?'
  OR trim(full_name) ~* '\b(consent|privacy|confidential|legislation|do you|please|enter|select|tick|same as|relationship to|phone number|address|gender|date of birth|new patient form|personal details information sheet|intake form)\b'
  OR trim(full_name) ~* '^(not specified|n/?a|unknown|gp|none|null|undefined|as above)$'
  OR trim(full_name) ~* '[0-9]'
  OR trim(full_name) !~* '^(dr\.?\s+|doctor\s+)?[a-z][a-z''.-]*(\s+[a-z][a-z''.-]*){0,3}$';

-- 4) Normalize whitespace for remaining rows.
UPDATE source_contacts
SET name = regexp_replace(trim(name), '\s+', ' ', 'g');

UPDATE doctors
SET full_name = regexp_replace(trim(full_name), '\s+', ' ', 'g');

-- 5) Remove case-insensitive duplicates after normalization.
WITH dedup AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(name)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM source_contacts
)
DELETE FROM source_contacts s
USING dedup d
WHERE s.id = d.id
  AND d.rn > 1;

WITH dedup AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(full_name)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM doctors
)
DELETE FROM doctors d0
USING dedup d1
WHERE d0.id = d1.id
  AND d1.rn > 1;
