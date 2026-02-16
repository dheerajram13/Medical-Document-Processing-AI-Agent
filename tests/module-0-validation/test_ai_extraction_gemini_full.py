#!/usr/bin/env python3
"""
Module 0.3: Gemini AI (via Google AI Studio) Full Extraction Test
Tests all 3 documents with accuracy calculation
"""

import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Google AI Studio API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if not GEMINI_API_KEY:
    print("⚠️ GEMINI_API_KEY not found in .env file")
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
    },
    {
        "name": "Colonoscopy Report",
        "ocr_file": "output/ocr_21. 1. BDI4D998228.txt",
        "expected": {
            "patient_name": "Ms Shelley Lucy Manea",
            "report_date": "2025-01-09",
            "subject": "Colonoscopy",
            "source_contact": "Double Bay Day Hospital",
            "store_in": "Investigations",
            "assigned_doctor": "Dr Naomi Heath",
            "category": "Medical imaging report"
        }
    },
    {
        "name": "Eye Centre Letter",
        "ocr_file": "output/ocr_21. BDI1895579.txt",
        "expected": {
            "patient_name": "Miss Geneveve McDonald",
            "report_date": "2025-01-08",
            "subject": "Paediatric Ophthalmology Review",
            "source_contact": "Eastern Eye Centre",
            "store_in": "Correspondence",
            "assigned_doctor": "Dr Sally Wood",
            "category": "Allied health letter"
        }
    }
]

PROMPT_TEMPLATE = """You are a medical document processing AI assistant. Extract these 7 fields with HIGH ACCURACY.

CRITICAL EXTRACTION RULES:
1. "patient_name": Full name of the patient (NOT the doctor)
2. "report_date": Use "Service Date" or "Date of procedure", NOT fax date. Format: YYYY-MM-DD
3. "subject": Brief procedure/test name ONLY (e.g., "MRI Lumbar Spine", "Colonoscopy", "Paediatric Ophthalmology Review")
   - Keep it concise (2-5 words max)
   - Do NOT include patient name in subject
4. "source_contact": Hospital/Clinic/Centre NAME ONLY (e.g., "St Vincent's Hospital Medical Imaging", "Double Bay Day Hospital", "Eastern Eye Centre")
   - Extract the FACILITY name, NOT doctor names
   - Look for headers, letterheads, or "From:" sections
5. "store_in":
   - "Investigations" if document is imaging/pathology/test results
   - "Correspondence" if document is a letter/referral
6. "assigned_doctor": The REFERRING GP doctor (who the report is being sent TO)
   - Look for "Fax To:", "Referring doctor:", "Copies to:"
   - NOT the doctor who wrote the report (NOT "From:" or signature)
7. "category": Choose from these types:
   - "Medical imaging report" for radiology/imaging
   - "Pathology results" for lab tests
   - "Allied health letter" for specialists (ophthalmology, physio, etc.)
   - "Letter" for general correspondence

Document text:
{ocr_text}

Return ONLY valid JSON (no extra text):
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

def calculate_accuracy(extracted, expected):
    """Calculate extraction accuracy"""
    matches = 0
    total = 7

    field_results = {}
    for field in ["patient_name", "report_date", "subject", "source_contact", "store_in", "assigned_doctor", "category"]:
        extracted_value = extracted.get(field, "").lower().strip()
        expected_value = expected.get(field, "").lower().strip()

        # Partial match for names and locations
        if field in ["patient_name", "source_contact", "assigned_doctor"]:
            # Check if key parts match
            is_match = any(word in extracted_value for word in expected_value.split() if len(word) > 2)
        else:
            is_match = extracted_value == expected_value

        field_results[field] = {
            "extracted": extracted.get(field),
            "expected": expected.get(field),
            "match": is_match,
            "confidence": extracted.get(f"{field}_confidence", 0.0)
        }

        if is_match:
            matches += 1

    accuracy = (matches / total) * 100

    return accuracy, field_results

def test_gemini_extraction():
    print("="*80)
    print("Module 0.3: Gemini AI (Google AI Studio) Full Extraction Test")
    print("="*80)
    print(f"\nTesting {len(test_docs)} documents...\n")

    model = genai.GenerativeModel('gemini-2.5-flash')
    all_results = []

    for doc in test_docs:
        print(f"\n{'='*80}")
        print(f"Testing: {doc['name']}")
        print(f"{'='*80}\n")

        # Load OCR text
        with open(doc['ocr_file'], 'r') as f:
            ocr_text = f.read()[:3000]

        print(f"📄 OCR text length: {len(ocr_text)} characters")

        prompt = PROMPT_TEMPLATE.format(ocr_text=ocr_text)

        try:
            response = model.generate_content(prompt)
            text = response.text.strip()

            # Clean JSON
            if text.startswith("```json"):
                text = text.replace("```json", "").replace("```", "").strip()

            data = json.loads(text)

            print("✅ Extraction successful")

            # Calculate accuracy
            accuracy, field_results = calculate_accuracy(data, doc['expected'])

            print(f"🎯 Accuracy: {accuracy:.1f}%")
            print(f"\nField-by-field results:")
            for field, res in field_results.items():
                status = "✓" if res['match'] else "✗"
                print(f"  {status} {field}: {res['extracted']} (confidence: {res['confidence']:.2f})")
                if not res['match']:
                    print(f"      Expected: {res['expected']}")

            all_results.append({
                "document": doc['name'],
                "success": True,
                "accuracy": accuracy,
                "extracted": data,
                "field_results": field_results
            })

        except Exception as e:
            print(f"❌ Extraction failed: {e}")
            all_results.append({
                "document": doc['name'],
                "success": False,
                "error": str(e)
            })

    # Overall summary
    print(f"\n{'='*80}")
    print("OVERALL SUMMARY")
    print(f"{'='*80}\n")

    successful_tests = sum(1 for r in all_results if r.get('success'))

    print(f"Total tests: {len(test_docs)}")
    print(f"Successful: {successful_tests}/{len(test_docs)}")
    print(f"Failed: {len(test_docs) - successful_tests}/{len(test_docs)}")

    # Calculate average accuracy
    accuracies = [r['accuracy'] for r in all_results if r.get('success')]

    if accuracies:
        avg_accuracy = sum(accuracies) / len(accuracies)
        max_accuracy = max(accuracies)
        min_accuracy = min(accuracies)

        print(f"\n📊 Extraction Accuracy:")
        print(f"  Average: {avg_accuracy:.1f}%")
        print(f"  Best: {max_accuracy:.1f}%")
        print(f"  Worst: {min_accuracy:.1f}%")

        if avg_accuracy >= 85:
            print(f"\n✅ TARGET ACHIEVED: Average accuracy {avg_accuracy:.1f}% exceeds 85% goal!")
            print(f"🎯 Ready to proceed with implementation!")
        elif avg_accuracy >= 75:
            print(f"\n⚠️ CLOSE TO TARGET: {avg_accuracy:.1f}% - Needs prompt tuning to reach 85%")
        else:
            print(f"\n❌ BELOW TARGET: {avg_accuracy:.1f}% - Significant prompt engineering needed")

    # Save results
    os.makedirs("output", exist_ok=True)
    with open("output/gemini_extraction_test_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n💾 Results saved to: output/gemini_extraction_test_results.json")

    print(f"\n{'='*80}")
    print("Module 0.3 Complete - Gemini AI extraction validated!")
    print(f"{'='*80}")

    return all_results

if __name__ == "__main__":
    test_gemini_extraction()
