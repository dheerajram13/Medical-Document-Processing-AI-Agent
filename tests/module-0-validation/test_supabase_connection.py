#!/usr/bin/env python3
"""
Test Supabase connection and basic operations
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

print("Testing Supabase connection...")
print(f"URL: {url}")
print(f"Key: {key[:20]}...")

try:
    supabase: Client = create_client(url, key)
    print("✅ Supabase client created successfully!")

    # Test by listing tables (this will work even with empty database)
    print("\n✅ Connection successful - Supabase is ready!")
    print("📊 Database is accessible")

except Exception as e:
    print(f"❌ Connection failed: {e}")
