# Medical Document AI - Medical Document Processing AI Agent

AI-powered system for OCR + structured extraction of medical document metadata with receptionist review before approval.

## Production Access

- Frontend (Vercel): `https://medical-document-processing-ai-agen.vercel.app`
- Backend API (Render): `https://medical-document-processing-ai-agent.onrender.com`
- Backend health: `https://medical-document-processing-ai-agent.onrender.com/health`

## Core Workflow

1. Upload PDF/DOCX document.
2. OCR extracts text and layout metadata.
3. AI prioritizes extraction of 7 core filing fields (and captures additional fields when available).
4. Review queue shows confidence and extracted values.
5. Receptionist corrects/approves/rejects.

## Core Filing Fields (Prioritized)

These are the primary fields used for filing and review. The system also extracts additional metadata/clinical fields when present in the document.

1. `patient_name`
2. `report_date`
3. `subject`
4. `source_contact`
5. `store_in` (`Investigations` | `Correspondence`)
6. `assigned_doctor`
7. `category`

## Tech Stack

- Frontend: Next.js 16 + TypeScript + Tailwind
- Backend: NestJS + TypeScript
- OCR: Azure Document Intelligence
- AI: Gemini + Claude fallback
- Data: Supabase Postgres + Storage
- Hosting: Vercel (frontend), Render (backend)

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone <repository-url>
cd Medical-Document-Processing-AI-Agent

# backend
cd backend
npm install

# frontend
cd ../frontend
npm install
```

### Environment

- Backend env: `backend/.env`
- Frontend env: `frontend/.env.local`

Minimum frontend env:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
```

Start apps:

```bash
# terminal 1
cd backend
npm run start:dev

# terminal 2
cd frontend
npm run dev -- -p 3002
```

## Deployment Notes

- Backend expects `CORS_ORIGINS` (comma-separated allowlist).
- For Vercel + local testing:

```env
CORS_ORIGINS=https://*.vercel.app,http://localhost:3002
```

- Full deployment runbook: `docs/deployment/EC2_VERCEL_DEPLOYMENT.md`

## API Endpoints (Key)

- `GET /health`
- `POST /documents/process`
- `GET /documents/queue/review`
- `GET /documents/:id`
- `POST /documents/:id/update`
- `POST /documents/:id/approve`
- `POST /documents/:id/reject`

## Engineering Best Practices

### SOLID and Design

- Keep OCR, extraction, and document workflows in separate modules/services.
- Keep controller methods thin; business logic belongs in services.
- Use typed interfaces for DTOs and extracted payloads.
- Add small helper methods for normalization/validation rather than duplicating logic.

### Logging

- Use structured stage logging for processing timing (`upload`, `ocr`, `ai`, `save`, `status`).
- Avoid logging secrets or raw credentials.
- Log CORS allowlist and blocked origins in production for faster incident diagnosis.

### Validation and Safety

- Validate required review fields before approval.
- Validate lookup-backed fields against available lookup values.
- Keep date parsing strict (`YYYY-MM-DD` with calendar validation).

### Reusability and Maintainability

- Centralize constants and regex patterns used across extraction logic.
- Keep environment configuration in `.env.example` with placeholders only.
- Prefer small composable functions over long controller logic.

### Deployment Hygiene

- Use `npm ci` in CI/deployment for reproducible installs.
- Keep health checks (`/health`) and smoke tests in release checklist.
- Run database migrations before production cutover.

## Security

- Never commit `.env` or credentials.
- Keep Supabase service key backend-only.
- See `SECURITY.md` and run:

```bash
./scripts/verify_security.sh
```

## Current Status

- Upload -> OCR -> AI extraction -> review queue is live.
- PDF highlight support works for selectable and scanned documents.
- Render + Vercel production deployment is active.
