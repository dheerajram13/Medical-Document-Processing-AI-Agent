#!/usr/bin/env python3
"""
Module 0.3: Vertex AI (Gemini 2.5 Flash) Extraction Test
Tests AI extraction of 7 required fields from OCR text
"""

import os
import json
from dotenv import load_dotenv
import vertexai
from vertexai.generative_models import GenerativeModel

# Load environment variables
load_dotenv()

# Google Vertex AI credentials
project_id = os.getenv("GOOGLE_PROJECT_ID")
location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

# Set credentials environment variable for Google SDK
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path

# Initialize Vertex AI
vertexai.init(project=project_id, location=location)

# Test documents (using OCR output from Module 0.2)
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

# Prompt variations to test
PROMPT_TEMPLATES = {
    "detailed": """You are a medical document processing AI assistant. Extract the following 7 fields from this medical document with high accuracy.

IMPORTANT INSTRUCTIONS:
1. For "assigned_doctor": Extract the REFERRING GP doctor (look for "Fax To:", "Referring doctor:", "Copies to:"), NOT the reporting specialist in "From:" field
2. For "report_date": Prioritize "Service Date" or "Date of procedure" over fax date
3. For "subject": Extract the procedure/test name (e.g., "MRI Lumbar Spine", "Colonoscopy")
4. For "source_contact": Extract the hospital/clinic name only (not full address)
5. For "store_in": Return "Investigations" if this is imaging/pathology/test results, or "Correspondence" if it's a letter/referral
6. For "category": Choose the most appropriate from the list below

Document text:
{ocr_text}

7 FIELDS TO EXTRACT:
1. patient_name: Full name of the patient
2. report_date: Date of the report/service (format: YYYY-MM-DD)
3. subject: Brief description of procedure/test
4. source_contact: Name of hospital/clinic/facility
5. store_in: "Investigations" or "Correspondence"
6. assigned_doctor: The referring GP doctor name (NOT the reporting specialist)
7. category: Document type from [Medical imaging report, Pathology results, Discharge summary, Referral letter, Letter, ECG, Certificate, Allied health letter, Immunisation, Clinical notes, Consent form, Admission summary, Advance care planning, Clinical photograph, DAS21, Email, Form, Indigenous PIP, MyHealth registration, New PT registration form, Patient consent, Record request, Workcover, Workcover consent]

Return ONLY valid JSON in this exact format (no other text):
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
}}""",

    "concise": """Extract these 7 fields from the medical document. Return only JSON.

Document: {ocr_text}

Required fields (with confidence 0.0-1.0):
- patient_name: Patient's full name
- report_date: Service/procedure date (YYYY-MM-DD)
- subject: Procedure/test name
- source_contact: Hospital/clinic name
- store_in: "Investigations" or "Correspondence"
- assigned_doctor: Referring GP (from "Fax To:" NOT "From:")
- category: Document type

JSON format:
{{"patient_name": "...", "patient_name_confidence": 0.95, ...}}""",

    "role_based": """You are an experienced medical receptionist who processes incoming medical documents for a GP clinic.

Your task: Extract 7 key fields from this document to file it correctly in the practice management system.

CRITICAL: The "assigned_doctor" is the REFERRING GP (who sent the patient), NOT the specialist who wrote the report.

Document text:
{ocr_text}

Extract these fields and return as JSON with confidence scores (0.0-1.0):
1. patient_name
2. report_date (YYYY-MM-DD format)
3. subject (procedure/test name)
4. source_contact (facility name)
5. store_in ("Investigations" for tests/imaging, "Correspondence" for letters)
6. assigned_doctor (referring GP)
7. category (document type)

Return only the JSON object."""
}

def extract_fields_with_ai(ocr_text, prompt_template="detailed"):
    """Extract 7 fields using Vertex AI Gemini"""

    # Format prompt
    prompt = PROMPT_TEMPLATES[prompt_template].format(ocr_text=ocr_text[:3000])  # Limit to 3000 chars

    # Initialize model
    model = GenerativeModel("gemini-2.0-flash-exp")

    try:
        # Generate response
        response = model.generate_content(prompt)

        # Extract JSON from response
        response_text = response.text.strip()

        # Clean up response (remove markdown code blocks if present)
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()

        # Parse JSON
        extracted_data = json.loads(response_text)

        return {
            "success": True,
            "data": extracted_data,
            "raw_response": response.text
        }

    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"JSON parsing error: {str(e)}",
            "raw_response": response.text if 'response' in locals() else None
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

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

def main():
    print("="*80)
    print("Module 0.3: Vertex AI (Gemini 2.0 Flash) Extraction Test")
    print("="*80)
    print(f"\nProject ID: {project_id}")
    print(f"Location: {location}")
    print(f"Credentials: {credentials_path}")
    print(f"\nTesting {len(test_docs)} documents with {len(PROMPT_TEMPLATES)} prompt variations...\n")

    all_results = []

    # Test each document with each prompt template
    for doc in test_docs:
        print(f"\n{'='*80}")
        print(f"Testing: {doc['name']}")
        print(f"{'='*80}\n")

        # Read OCR text
        with open(doc['ocr_file'], 'r', encoding='utf-8') as f:
            ocr_text = f.read()

        print(f"📄 OCR text length: {len(ocr_text)} characters")

        doc_results = {
            "document": doc['name'],
            "expected": doc['expected'],
            "prompts": {}
        }

        # Test each prompt template
        for prompt_name, _ in PROMPT_TEMPLATES.items():
            print(f"\n--- Testing prompt: {prompt_name} ---")

            result = extract_fields_with_ai(ocr_text, prompt_name)

            if result['success']:
                print(f"✅ Extraction successful")

                # Calculate accuracy
                accuracy, field_results = calculate_accuracy(result['data'], doc['expected'])

                print(f"🎯 Accuracy: {accuracy:.1f}%")
                print(f"\nField-by-field results:")
                for field, res in field_results.items():
                    status = "✓" if res['match'] else "✗"
                    print(f"  {status} {field}: {res['extracted']} (confidence: {res['confidence']:.2f})")
                    if not res['match']:
                        print(f"      Expected: {res['expected']}")

                doc_results['prompts'][prompt_name] = {
                    "success": True,
                    "accuracy": accuracy,
                    "extracted": result['data'],
                    "field_results": field_results
                }
            else:
                print(f"❌ Extraction failed: {result['error']}")
                if result.get('raw_response'):
                    print(f"Raw response: {result['raw_response'][:500]}...")

                doc_results['prompts'][prompt_name] = {
                    "success": False,
                    "error": result['error']
                }

        all_results.append(doc_results)

    # Overall summary
    print(f"\n{'='*80}")
    print("OVERALL SUMMARY")
    print(f"{'='*80}\n")

    total_tests = len(test_docs) * len(PROMPT_TEMPLATES)
    successful_tests = sum(
        1 for doc in all_results
        for prompt_result in doc['prompts'].values()
        if prompt_result.get('success')
    )

    print(f"Total tests: {total_tests}")
    print(f"Successful: {successful_tests}/{total_tests}")
    print(f"Failed: {total_tests - successful_tests}/{total_tests}")

    # Calculate average accuracy
    accuracies = [
        prompt_result['accuracy']
        for doc in all_results
        for prompt_result in doc['prompts'].values()
        if prompt_result.get('success')
    ]

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

        # Best prompt
        best_prompt = max(
            [(prompt, sum(doc['prompts'][prompt]['accuracy'] for doc in all_results if doc['prompts'][prompt].get('success')) / len(test_docs))
             for prompt in PROMPT_TEMPLATES.keys()],
            key=lambda x: x[1]
        )
        print(f"\n🏆 Best prompt template: '{best_prompt[0]}' with {best_prompt[1]:.1f}% average accuracy")

    # Save results
    with open("output/ai_extraction_test_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n💾 Results saved to: output/ai_extraction_test_results.json")

    print(f"\n{'='*80}")
    print("Module 0.3 Complete - Ready for Module 0.4 (Credentials Validation)")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()
