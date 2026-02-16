# Supabase Database Setup

## Database Schema

### Tables

1. **documents** - Stores uploaded document metadata
2. **extracted_data** - Stores AI-extracted field data with confidence scores
3. **review_queue** - Manages human review workflow
4. **audit_log** - Tracks all actions and changes
5. **pms_export_log** - Logs PMS export attempts and results

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for MVP)

1. Go to your Supabase project: https://supabase.com/dashboard/project/hkluxxafvxywzklrtrsm
2. Navigate to **SQL Editor**
3. Copy the contents of `migrations/001_initial_schema.sql`
4. Paste and run the SQL

### Option 2: Supabase CLI (For local development)

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref hkluxxafvxywzklrtrsm

# Run migrations
supabase db push
```

## Storage Buckets

Create these storage buckets in Supabase Dashboard → Storage:

1. **documents** - For storing uploaded PDF/image files
   - Public: No
   - File size limit: 10MB
   - Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`

### Storage Policies (RLS)

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- Allow service role to read all
CREATE POLICY "Allow service role read" ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'documents');
```

## Row Level Security (RLS)

For MVP, we're using the service_role key from backend only, so RLS is optional.

For production with user authentication:

```sql
-- Enable RLS on all tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;

-- Create policies (example)
CREATE POLICY "Users can view their documents" ON documents
  FOR SELECT USING (auth.uid()::text = created_by);
```

## Database Connection

The backend connects using the `SUPABASE_SERVICE_KEY` for full access.

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
```

## Verification

After running migrations, verify:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check row counts
SELECT
  'documents' as table, COUNT(*) as rows FROM documents
UNION ALL
SELECT 'extracted_data', COUNT(*) FROM extracted_data
UNION ALL
SELECT 'review_queue', COUNT(*) FROM review_queue;
```

## Seed Data (Optional)

For testing, you can add seed data:

```sql
-- Insert a test document
INSERT INTO documents (file_name, file_path, status)
VALUES ('test-document.pdf', '/documents/test-document.pdf', 'pending');
```
