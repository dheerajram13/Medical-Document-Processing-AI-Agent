# Tests Directory

## Structure

```
tests/
├── module-0-validation/     # Pre-implementation validation tests
│   ├── test_ocr.py                        # Azure OCR testing
│   ├── test_ai_extraction.py              # Vertex AI extraction
│   ├── test_ai_extraction_gemini.py       # Quick Gemini test
│   ├── test_ai_extraction_gemini_full.py  # Full Gemini test (3 docs)
│   ├── test_credentials.py                # Credential validation
│   └── test_supabase_connection.py        # Supabase connection test
├── backend/                 # Backend unit & integration tests (future)
└── frontend/                # Frontend component tests (future)
```

## Running Tests

### Module 0 Validation Tests

From project root:

```bash
# OCR test
python3 tests/module-0-validation/test_ocr.py

# AI extraction test (full)
python3 tests/module-0-validation/test_ai_extraction_gemini_full.py

# Credentials validation
python3 tests/module-0-validation/test_credentials.py

# Supabase connection
python3 tests/module-0-validation/test_supabase_connection.py
```

### Future Tests

```bash
# Backend tests (NestJS)
cd backend
npm test

# Frontend tests (Next.js)
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## Test Results

Results are saved to `output/` directory:
- `output/ocr_test_results.json`
- `output/gemini_extraction_test_results.json`
- `output/ai_extraction_test_results.json` (Vertex AI - when billing ready)
