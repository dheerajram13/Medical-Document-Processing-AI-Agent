# Medical Document Processing Backend

NestJS backend API for processing medical documents with OCR and AI extraction.

## Features

- **OCR Integration**: Azure Document Intelligence for text extraction from PDFs
- **AI Extraction**: Multi-provider support (Google Gemini + Anthropic Claude)
- **Document Storage**: Supabase PostgreSQL database
- **File Storage**: Supabase Storage buckets

## AI Provider Configuration

The extraction service supports multiple AI providers with automatic fallback:

### Supported Providers

1. **Google Gemini** (Default, Free Tier Available)
   - Model: `gemini-2.0-flash`
   - Free tier: 1,500 requests/day
   - Configuration: `GEMINI_API_KEY`

2. **Anthropic Claude** (Fallback)
   - Model: `claude-3-5-sonnet-20241022`
   - New accounts get $5 in credits
   - Configuration: `ANTHROPIC_API_KEY`

### Environment Variables

```bash
# Choose AI provider: 'gemini' or 'claude'
AI_PROVIDER=gemini

# Google Gemini API (free tier)
GEMINI_API_KEY=your_gemini_api_key_here

# Anthropic Claude API (optional fallback)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### How It Works

1. **Primary Provider**: Uses the provider specified in `AI_PROVIDER`
2. **Automatic Fallback**: If primary fails, automatically tries the other provider
3. **Smart Initialization**: If only one API key is configured, uses that provider

### Getting API Keys

**Google Gemini (Free):**
1. Go to https://aistudio.google.com/apikey
2. Create an API key
3. Free tier: 1,500 requests per day

**Anthropic Claude:**
1. Go to https://console.anthropic.com/
2. Sign up (new accounts get $5 credit)
3. Create an API key

## API Endpoints

### OCR Extraction

```bash
POST /ocr/extract
Content-Type: multipart/form-data

# Response
{
  "success": true,
  "data": {
    "text": "extracted text...",
    "pages": 2,
    "confidence": 0.965
  }
}
```

### AI Field Extraction

```bash
POST /extraction/extract
Content-Type: application/json
Body: {"ocrText": "medical document text..."}

# Response
{
  "success": true,
  "data": {
    "extractedFields": {
      "patientName": "John Doe",
      "patientNameConfidence": 0.95,
      "reportDate": "2025-01-15",
      "storeIn": "Investigations",
      ...
    }
  }
}
```

## Running the Server

```bash
npm install
npm run start:dev
```

## Environment Setup

Configure `.env` in the project root with required API keys.
