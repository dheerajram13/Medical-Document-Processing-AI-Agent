# Deployment Guide (Recommended Stack)

This guide matches the assessment stack:
- Frontend: Vercel
- Backend: AWS EC2 (NestJS)
- Database/Storage: Supabase

## 1. Backend Deployment (AWS EC2)

### 1.1 Launch EC2
- AMI: Amazon Linux 2023 (recommended)
- Instance type: `t3.small` (MVP)
- Security Group inbound:
  - `22` (SSH) from your IP
  - `80` (HTTP) from anywhere
  - `443` (HTTPS) from anywhere (if SSL later)

### 1.2 SSH and install runtime
```bash
ssh -i <your-key>.pem ec2-user@<EC2_PUBLIC_IP>

sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git nginx
sudo npm install -g pm2
```

### 1.3 Deploy backend code
```bash
git clone <YOUR_REPO_URL> Medical-Document-Processing-AI-Agent
cd Medical-Document-Processing-AI-Agent/backend
cp ../.env.example .env
```

Edit `backend/.env` and set real values:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `AZURE_DOC_INTELLIGENCE_ENDPOINT`
- `AZURE_DOC_INTELLIGENCE_KEY`
- `GEMINI_API_KEY` and/or `ANTHROPIC_API_KEY`
- `AI_PROVIDER`
- `PORT=3000`
- `CORS_ORIGINS=https://<your-vercel-domain>,http://localhost:3002`

Run deployment script:
```bash
cd ~/Medical-Document-Processing-AI-Agent
chmod +x scripts/deploy_ec2_backend.sh
./scripts/deploy_ec2_backend.sh <YOUR_REPO_URL>
```

### 1.4 Configure NGINX reverse proxy
```bash
sudo cp ~/Medical-Document-Processing-AI-Agent/scripts/nginx/samantha-api.conf /etc/nginx/conf.d/samantha-api.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

Smoke tests:
```bash
curl http://127.0.0.1:3000/health
curl http://<EC2_PUBLIC_IP>/health
pm2 status
```

## 2. Frontend Deployment (Vercel)

### 2.1 Connect repo
- Import repo in Vercel.
- Framework preset: Next.js.

### 2.2 Set environment variable in Vercel
- `NEXT_PUBLIC_API_URL=http://<EC2_PUBLIC_IP>`

If you later add a domain + SSL for backend, switch to `https://...`.

### 2.3 Deploy
- Push to your selected branch (usually `main`).
- Verify frontend loads and connects to backend.

## 3. Supabase Deployment Checklist

- Confirm migrations applied:
  - `001_initial_schema.sql`
  - `002_extracted_data_extended_fields.sql`
  - `003_review_workflow_fields.sql`
  - `004_lookup_data_cleanup.sql`
- Confirm Storage bucket `documents` exists.
- Confirm seed lookup data exists (patients/doctors/sources).
- Verify backend can read/write to Supabase with service key.

## 4. Final Smoke Test

1. Open deployed frontend.
2. Upload 1 document.
3. Verify processing completes and appears in review queue.
4. Open review detail and confirm:
   - PDF preview loads
   - extracted fields present
   - save/approve/reject work
5. Confirm backend health endpoint:
   - `GET /health` returns `{"status":"ok",...}`

