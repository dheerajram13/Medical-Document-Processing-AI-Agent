# Security Guidelines

## 🔒 Critical: Never Commit Credentials

### Files to NEVER commit:
- ✅ `.env` - Environment variables (already in .gitignore)
- ✅ `samantha-ai-*.json` - Google service account keys (already in .gitignore)
- ✅ `*.pem` - AWS private keys (already in .gitignore)
- ✅ Any file containing API keys or secrets

### Before First Git Commit:

1. **Verify .gitignore**
   ```bash
   git status
   # Should NOT show:
   # - .env
   # - samantha-ai-487602-cd4f96219b94.json
   # - input/ folder with PDFs
   ```

2. **Check for exposed secrets**
   ```bash
   grep -r "AIzaSy" . --exclude-dir=node_modules --exclude-dir=.git
   grep -r "eyJhbGci" . --exclude-dir=node_modules --exclude-dir=.git
   # Should only show .env file (which is gitignored)
   ```

3. **Use .env.example instead**
   - `.env.example` contains template with placeholder values
   - Safe to commit to repository
   - Others can copy to `.env` and add their own credentials

---

## 🛡️ Security Best Practices

### API Keys Management

1. **Azure Document Intelligence**
   - Store in `.env` only
   - Use environment variables in code
   - Rotate keys periodically

2. **Google AI (Gemini/Vertex AI)**
   - Service account JSON file should be outside repo OR gitignored
   - Use environment variable for API key
   - Never hardcode in source code

3. **Supabase**
   - Anon key is safe for frontend (public)
   - Service key must NEVER be exposed to frontend
   - Service key only in backend `.env`

4. **AWS Credentials**
   - Use IAM roles in production
   - Never commit access keys
   - Use AWS SSM Parameter Store for production secrets

---

## 📋 Pre-Commit Checklist

Before running `git add .`:

- [ ] Check `git status` - no `.env` files listed
- [ ] Check `git status` - no `*.json` service account files
- [ ] Check `git status` - no PDF files from input/
- [ ] Verify all secrets are in `.env` (not hardcoded)
- [ ] Verify `.env.example` has placeholders only
- [ ] Run security scan: `git secrets --scan` (if installed)

---

## 🔐 Environment Variables Structure

### Development (.env)
```env
# Real credentials here
AZURE_DOC_INTELLIGENCE_KEY=CWDLwtwKE7...
GEMINI_API_KEY=AIzaSy...
SUPABASE_SERVICE_KEY=eyJhbGci...
```

### Template (.env.example)
```env
# Placeholders only
AZURE_DOC_INTELLIGENCE_KEY=your-api-key-here
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_SERVICE_KEY=your-service-key
```

---

## 🚨 If Credentials Are Accidentally Committed

1. **DO NOT just delete and commit again** - Git history keeps them
2. **Rotate ALL exposed credentials immediately**:
   - Azure: Regenerate key in Azure Portal
   - Gemini: Delete and create new API key
   - Supabase: Reset database password, regenerate JWT secrets
3. **Use git-filter-branch or BFG Repo-Cleaner** to remove from history
4. **Force push** to overwrite remote history (coordinate with team)

---

## 🔒 Production Security

### Backend (NestJS)
- Use environment variables ONLY
- Never log credentials
- Use helmet.js for security headers
- Enable CORS whitelist
- Rate limiting on API endpoints

### Frontend (Next.js)
- Only use `NEXT_PUBLIC_*` for frontend-safe variables
- NEVER expose service keys
- Use Supabase anon key only (RLS protects data)

### Database (Supabase)
- Enable Row Level Security (RLS)
- Create policies for each table
- Use service role key only in backend
- Audit database access logs

### File Storage
- Set proper bucket policies
- Sign upload URLs with expiration
- Validate file types and sizes
- Scan uploaded files for malware (future)

---

## 📝 Code Review Checklist

Before merging any PR:

- [ ] No hardcoded credentials
- [ ] All secrets use environment variables
- [ ] No console.log() of sensitive data
- [ ] API keys not in client-side code
- [ ] Proper error messages (don't leak internals)

---

## 🛠️ Tools

### Install git-secrets (recommended)
```bash
# macOS
brew install git-secrets

# Initialize in repo
git secrets --install
git secrets --register-aws
```

### Scan before commit
```bash
git secrets --scan
```

---

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth)
- [Google Cloud Security](https://cloud.google.com/security/best-practices)
- [Azure Security](https://docs.microsoft.com/azure/security/)

---

**Last Updated**: 2026-02-16
**Status**: Active - Review before each commit
