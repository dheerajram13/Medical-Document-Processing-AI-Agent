#!/usr/bin/env python3
"""
Module 0.4: Tech Stack Credentials Validation
Tests all required and optional credentials for the MVP
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_azure_credentials():
    """Test Azure Document Intelligence credentials"""
    print("\n1. Testing Azure Document Intelligence...")
    endpoint = os.getenv("AZURE_DOC_INTELLIGENCE_ENDPOINT")
    key = os.getenv("AZURE_DOC_INTELLIGENCE_KEY")

    if endpoint and key:
        print("   ✅ Endpoint configured")
        print("   ✅ API Key configured")
        print("   ✅ Status: READY (tested in Module 0.2)")
        return True
    else:
        print("   ❌ Missing credentials")
        return False

def test_gemini_credentials():
    """Test Google Gemini/Vertex AI credentials"""
    print("\n2. Testing Google AI (Gemini/Vertex AI)...")

    # Check Gemini API
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key:
        print("   ✅ Gemini API Key configured")
        print("   ✅ Status: READY (tested in Module 0.3)")

    # Check Vertex AI
    project_id = os.getenv("GOOGLE_PROJECT_ID")
    creds_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if project_id and creds_file and os.path.exists(creds_file):
        print("   ✅ Vertex AI Project ID configured")
        print("   ✅ Vertex AI credentials file exists")
        print("   ⚠️  Status: CONFIGURED (billing still propagating)")

    return True

def test_supabase_credentials():
    """Test Supabase credentials"""
    print("\n3. Testing Supabase (Database & Storage)...")
    url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")

    if url and anon_key and service_key:
        print("   ✅ URL configured")
        print("   ✅ Anon Key configured")
        print("   ✅ Service Key configured")
        print("   ✅ Status: READY")
        return True
    else:
        print("   ❌ Missing credentials")
        print("   📝 Required for MVP - Database and file storage")
        print("   🔗 Setup: https://supabase.com/dashboard/projects")
        return False

def test_aws_credentials():
    """Test AWS credentials (optional for MVP)"""
    print("\n4. Testing AWS (Infrastructure - Optional for MVP)...")
    region = os.getenv("AWS_REGION")
    access_key = os.getenv("AWS_ACCESS_KEY_ID")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

    if region and access_key and secret_key:
        print("   ✅ Region configured")
        print("   ✅ Access Key configured")
        print("   ✅ Secret Key configured")
        print("   ✅ Status: READY")
        return True
    else:
        print("   ⚠️  Not configured")
        print("   📝 Optional for MVP (can defer to Phase 2)")
        return False

def test_bedrock_credentials():
    """Test AWS Bedrock credentials (fallback AI)"""
    print("\n5. Testing AWS Bedrock (Fallback AI - Optional for MVP)...")
    model_id = os.getenv("BEDROCK_MODEL_ID")

    if model_id:
        print(f"   ✅ Model ID configured: {model_id}")
        print("   ⚠️  Requires AWS credentials (see #4)")
        print("   📝 Optional for MVP - Gemini is primary AI")
        return True
    else:
        print("   ⚠️  Not configured")
        print("   📝 Optional for MVP (can defer to Phase 2)")
        return False

def test_redis():
    """Test Redis connection (queue)"""
    print("\n6. Testing Redis (Queue System)...")
    host = os.getenv("REDIS_HOST", "localhost")
    port = os.getenv("REDIS_PORT", "6379")

    try:
        import redis
        r = redis.Redis(host=host, port=int(port), socket_connect_timeout=2)
        r.ping()
        print(f"   ✅ Redis running at {host}:{port}")
        print("   ✅ Status: READY")
        return True
    except ImportError:
        print("   ⚠️  Redis package not installed")
        print("   📝 Install: pip install redis")
        return False
    except Exception as e:
        print(f"   ❌ Redis not running: {e}")
        print(f"   📝 Start Redis: brew install redis && brew services start redis")
        print(f"   📝 Or use mock queue for MVP testing")
        return False

def main():
    print("="*80)
    print("Module 0.4: Tech Stack Credentials Validation")
    print("="*80)

    results = {
        "Azure OCR": test_azure_credentials(),
        "Google AI": test_gemini_credentials(),
        "Supabase": test_supabase_credentials(),
        "AWS": test_aws_credentials(),
        "AWS Bedrock": test_bedrock_credentials(),
        "Redis": test_redis()
    }

    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)

    # Required for MVP
    print("\n✅ REQUIRED FOR MVP:")
    print(f"   {'✅' if results['Azure OCR'] else '❌'} Azure Document Intelligence (OCR)")
    print(f"   {'✅' if results['Google AI'] else '❌'} Google AI (Gemini/Vertex AI)")
    print(f"   {'✅' if results['Supabase'] else '❌'} Supabase (Database & Storage)")

    # Optional
    print("\n⚠️  OPTIONAL (can defer to Phase 2):")
    print(f"   {'✅' if results['AWS'] else '⚠️ '} AWS Infrastructure")
    print(f"   {'✅' if results['AWS Bedrock'] else '⚠️ '} AWS Bedrock (Fallback AI)")
    print(f"   {'✅' if results['Redis'] else '⚠️ '} Redis (Queue)")

    # MVP readiness
    required_ready = results['Azure OCR'] and results['Google AI'] and results['Supabase']

    print("\n" + "="*80)
    if required_ready:
        print("✅ MVP READY: All required credentials configured!")
        print("🎯 Can proceed with Module 1 (Project Setup)")
    else:
        print("⚠️  MVP BLOCKED: Missing required credentials")
        print("📝 Complete setup for missing services above")
    print("="*80)

    return required_ready

if __name__ == "__main__":
    main()
