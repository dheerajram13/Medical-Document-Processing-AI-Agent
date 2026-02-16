#!/bin/bash

echo "=================================="
echo "🔒 SECURITY VERIFICATION CHECK"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Check 1: .env is gitignored
echo "1. Checking if .env is gitignored..."
if git check-ignore .env > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ PASS${NC}: .env is properly gitignored"
    ((PASSED++))
else
    echo -e "   ${RED}❌ FAIL${NC}: .env is NOT gitignored!"
    ((FAILED++))
fi

# Check 2: Service account JSON is gitignored
echo ""
echo "2. Checking if service account JSON is gitignored..."
if git check-ignore samantha-ai-*.json > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ PASS${NC}: Service account JSON is gitignored"
    ((PASSED++))
else
    echo -e "   ${RED}❌ FAIL${NC}: Service account JSON is NOT gitignored!"
    ((FAILED++))
fi

# Check 3: input/ folder is gitignored
echo ""
echo "3. Checking if input/ folder is gitignored..."
if git check-ignore input/ > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ PASS${NC}: input/ folder is gitignored"
    ((PASSED++))
else
    echo -e "   ${RED}❌ FAIL${NC}: input/ folder is NOT gitignored!"
    ((FAILED++))
fi

# Check 4: No API keys in tracked files
echo ""
echo "4. Scanning for exposed API keys in tracked files..."
if git ls-files | xargs grep -l "AIzaSy" > /dev/null 2>&1; then
    echo -e "   ${RED}❌ FAIL${NC}: Found potential Gemini API key in tracked files!"
    ((FAILED++))
else
    echo -e "   ${GREEN}✅ PASS${NC}: No Gemini API keys in tracked files"
    ((PASSED++))
fi

# Check 5: No Supabase keys in tracked files
echo ""
echo "5. Scanning for exposed Supabase keys in tracked files..."
if git ls-files | xargs grep -l "eyJhbGciOiJIUzI1NiIs" > /dev/null 2>&1; then
    echo -e "   ${RED}❌ FAIL${NC}: Found potential Supabase JWT in tracked files!"
    ((FAILED++))
else
    echo -e "   ${GREEN}✅ PASS${NC}: No Supabase JWTs in tracked files"
    ((PASSED++))
fi

# Check 6: .env.example has placeholders only
echo ""
echo "6. Checking .env.example has placeholders only..."
if grep -q "your-" .env.example && ! grep -q "AIzaSy" .env.example; then
    echo -e "   ${GREEN}✅ PASS${NC}: .env.example has placeholders only"
    ((PASSED++))
else
    echo -e "   ${RED}❌ FAIL${NC}: .env.example may contain real credentials!"
    ((FAILED++))
fi

# Summary
echo ""
echo "=================================="
echo "SUMMARY"
echo "=================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED - Safe to commit!${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED - DO NOT COMMIT YET!${NC}"
    echo ""
    echo "Fix the failed checks before committing:"
    echo "1. Ensure .gitignore includes all sensitive files"
    echo "2. Remove any hardcoded credentials from code"
    echo "3. Use .env for all secrets"
    echo ""
    exit 1
fi
