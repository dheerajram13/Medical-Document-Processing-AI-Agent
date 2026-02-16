#!/usr/bin/env python3
"""
Module 0.3: Gemini AI (via Google AI Studio) Extraction Test
Alternative to Vertex AI - simpler setup, no billing required for testing
"""

import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Google AI Studio API Key (get from https://makersuite.google.com/app/apikey)
# For now, we'll use a placeholder - you'll need to add your key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    print("⚠️ GEMINI_API_KEY not found in .env file")
    print("\nTo use Google AI Studio (Gemini):")
    print("1. Go to: https://makersuite.google.com/app/apikey")
    print("2. Create an API key")
    print("3. Add to .env: GEMINI_API_KEY=your-key-here")
    print("\nOR wait 5-10 minutes for Vertex AI billing to propagate and re-run test_ai_extraction.py")
    exit(1)

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Test documents
test_docs = [
    {
        "name": "MRI Report",
        "ocr_file": "output/ocr_21. BDI12232519.txt",
        "expected": {
            "patient_name": "Stella ROBYN ENRIQUES",
            "report_date": "2025-01-13",
            "subject": "MRI Lumbar Spine",
            "source_contact": "St Vincent's Hospital Medical Imaging",
            "store_in": "Investigations",
            "assigned_doctor": "Dr Sally Wood",
            "category": "Medical imaging report"
        }
    }
]

PROMPT_TEMPLATE = """You are a medical document processing AI assistant. Extract these 7 fields with high accuracy.

IMPORTANT:
- "assigned_doctor": Extract REFERRING GP from "Fax To:" or "Referring doctor:", NOT "From:"
- "report_date": Prioritize "Service Date" over fax date (YYYY-MM-DD format)
- "store_in": "Investigations" for imaging/tests, "Correspondence" for letters

Document:
{ocr_text}

Return ONLY valid JSON:
{{
  "patient_name": "...",
  "patient_name_confidence": 0.95,
  "report_date": "YYYY-MM-DD",
  "report_date_confidence": 0.98,
  "subject": "...",
  "subject_confidence": 0.90,
  "source_contact": "...",
  "source_contact_confidence": 0.92,
  "store_in": "Investigations",
  "store_in_confidence": 0.97,
  "assigned_doctor": "...",
  "assigned_doctor_confidence": 0.88,
  "category": "Medical imaging report",
  "category_confidence": 0.99
}}"""

def test_gemini():
    print("Testing Gemini AI (Google AI Studio) for extraction...")

    # Use gemini-2.5-flash - latest available model
    model = genai.GenerativeModel('gemini-2.5-flash')

    # Load OCR text
    with open(test_docs[0]['ocr_file'], 'r') as f:
        ocr_text = f.read()[:3000]

    prompt = PROMPT_TEMPLATE.format(ocr_text=ocr_text)

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Clean JSON
        if text.startswith("```json"):
            text = text.replace("```json", "").replace("```", "").strip()

        data = json.loads(text)

        print("✅ SUCCESS!")
        print(json.dumps(data, indent=2))
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    test_gemini()
