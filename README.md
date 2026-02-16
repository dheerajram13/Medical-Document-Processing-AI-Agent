# Medical Document AI - Medical Document Processing AI Agent

AI-powered system for automated extraction of medical document metadata with human review workflow.

## 🎯 Project Overview

**Medical Document AI** processes incoming medical documents (faxes, scans, emails) and automatically extracts 7 key metadata fields using AI, presenting them for human review before importing into Practice Management Systems (PMS).

### Key Features
- 📄 **OCR Extraction** - Azure Document Intelligence (>95% accuracy)
- 🤖 **AI Field Extraction** - Google Gemini 2.5 Flash (90.5% accuracy)
- 👁️ **Human Review** - Override and approve before PMS import
- 🔄 **Queue Processing** - Background processing with Bull + Redis
- 🏥 **PMS Integration** - Best Practice EHR & Halo Connect
- 📊 **Analytics Dashboard** - Accuracy tracking and audit logs

---

## 📋 7 Required Fields

1. **patient_name** - Full name of the patient
2. **report_date** - Service/procedure date (YYYY-MM-DD)
3. **subject** - Brief procedure/test name
4. **source_contact** - Hospital/clinic/facility name
5. **store_in** - "Investigations" or "Correspondence"
6. **assigned_doctor** - Referring GP doctor
7. **category** - Document type (26 categories)

---

## 🏗️ Tech Stack

### Backend
- **NestJS** - API server
- **Supabase (Postgres)** - Database
- **Bull + Redis** - Queue management
- **AWS S3** - Document backup storage

### Frontend
- **Next.js 14** - React framework
- **Tailwind CSS** - Styling
- **React Query** - State management
- **Shadcn/ui** - Component library

### AI/ML Services
- **Azure Document Intelligence** - OCR extraction
- **Google Gemini 2.5 Flash** - Primary AI extraction
- **AWS Bedrock (Claude 3.5 Sonnet)** - Fallback AI

### Infrastructure
- **AWS EC2** - Backend hosting
- **Vercel** - Frontend hosting
- **Terraform** - Infrastructure as Code

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+ (for testing scripts)
- Redis (for queue)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Medical-Document-Processing-AI-Agent
   ```

2. **Copy environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your API credentials
   ```

3. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

4. **Setup database**
   ```bash
   # Run Supabase migrations
   npx supabase db push
   ```

5. **Start development servers**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run start:dev

   # Terminal 2: Frontend
   cd frontend
   npm run dev

   # Terminal 3: Queue worker
   cd backend
   npm run queue:worker
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

---

## 📁 Project Structure

```
Medical-Document-Processing-AI-Agent/
├── backend/                      # NestJS API server
│   ├── src/
│   │   ├── modules/
│   │   │   ├── documents/           # Document upload & storage
│   │   │   ├── ocr/                 # Azure OCR integration
│   │   │   ├── extraction/          # AI field extraction
│   │   │   ├── review/              # Human review workflow
│   │   │   ├── pms/                 # PMS integration
│   │   │   └── queue/               # Bull queue workers
│   │   ├── common/
│   │   └── main.ts
│   └── package.json
├── frontend/                     # Next.js web app
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── package.json
├── supabase/                     # Database schema & migrations
│   ├── migrations/
│   └── seed.sql
├── tests/                        # Test scripts
│   ├── module-0-validation/         # Pre-implementation validation
│   ├── backend/                     # Backend tests (future)
│   └── frontend/                    # Frontend tests (future)
├── scripts/                      # Utility scripts
│   └── verify_security.sh           # Pre-commit security check
├── docs/                         # Documentation
│   └── module-0/                    # Module 0 validation docs
├── output/                       # Test results (gitignored)
├── input/                        # Sample documents (gitignored)
├── .env                          # Environment variables (gitignored)
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── SECURITY.md                   # Security guidelines
├── plan.md                       # Implementation plan (gitignored)
└── README.md                     # This file
```

---

## 🧪 Module 0: Pre-Implementation Validation

**Status**: ✅ COMPLETE

### Module 0.1: Document Analysis
- ✅ Analyzed 18 sample medical documents
- ✅ Identified extraction patterns
- ✅ Expected accuracy: 90%+

### Module 0.2: OCR Testing
- ✅ Azure Document Intelligence tested
- ✅ 3/3 documents processed successfully
- ✅ OCR accuracy: >95%

### Module 0.3: AI Extraction Testing
- ✅ Google Gemini 2.5 Flash tested
- ✅ **Average accuracy: 90.5%** (exceeds 85% target!)
- ✅ MRI Report: 100%
- ✅ Colonoscopy: 85.7%
- ✅ Eye Centre Letter: 85.7%

### Module 0.4: Credentials Validation
- ✅ Azure Document Intelligence configured
- ✅ Google Gemini API configured
- ✅ Supabase database configured
- ✅ Redis queue running

**Result**: All validation tests passed. Ready for implementation.

See [docs/module-0/MODULE_0_COMPLETE.md](docs/module-0/MODULE_0_COMPLETE.md) for detailed results.

---

## 🔒 Security

**IMPORTANT**: Never commit credentials to Git.

- All API keys and secrets must be in `.env` (gitignored)
- Use `.env.example` as template with placeholders
- Service account JSON files are gitignored
- See [SECURITY.md](SECURITY.md) for full guidelines

### Pre-commit checklist:
- [ ] Run `git status` - verify no `.env` files
- [ ] Verify no `*.json` service account files
- [ ] Check no PDF files from `input/`
- [ ] All secrets in `.env`, not hardcoded

---

## 📊 Accuracy Targets

| Metric | Target | Achieved |
|--------|--------|----------|
| OCR Accuracy | >90% | **95%+** ✅ |
| AI Extraction | >85% | **90.5%** ✅ |
| Human Accuracy | >95% | TBD |
| End-to-End | >90% | TBD |

---

## 🗺️ Roadmap

### Phase 1: Core MVP (48 hours)
- [x] Module 0: Pre-implementation validation
- [ ] Module 1: Project setup & infrastructure
- [ ] Module 2: OCR integration
- [ ] Module 3: AI extraction service
- [ ] Module 4: Review workflow UI
- [ ] Module 5: PMS integration (mock)
- [ ] Module 6: Testing & deployment

### Phase 2: Production Features
- [ ] AWS infrastructure (EC2, S3)
- [ ] Monitoring & logging
- [ ] Error handling & retries
- [ ] Performance optimization
- [ ] CI/CD pipeline

### Phase 3: Advanced Features
- [ ] Multi-tenant support
- [ ] Advanced analytics
- [ ] Machine learning improvements
- [ ] Additional PMS integrations

---

## 🧪 Testing

### Run Module 0 validation tests
```bash
# OCR test
python3 tests/module-0-validation/test_ocr.py

# AI extraction test (full - 3 documents)
python3 tests/module-0-validation/test_ai_extraction_gemini_full.py

# Credentials validation
python3 tests/module-0-validation/test_credentials.py

# Supabase connection
python3 tests/module-0-validation/test_supabase_connection.py
```

### Security check
```bash
# Run before committing
./scripts/verify_security.sh
```

---

## 📝 API Documentation

API documentation will be available at:
- Swagger UI: http://localhost:4000/api
- OpenAPI JSON: http://localhost:4000/api-json

---

## 🤝 Contributing

1. Follow security guidelines in [SECURITY.md](SECURITY.md)
2. Never commit credentials or API keys
3. Write tests for new features
4. Follow existing code style
5. Update documentation

---

## 📄 License

[Add license information]

---


**Built with ❤️ for medical practice efficiency**

Last Updated: 2026-02-16
