#!/usr/bin/env bash
set -euo pipefail

# Deploy/update backend on EC2 (AWS stack):
# - pulls latest repo code
# - installs backend deps
# - builds NestJS app
# - restarts PM2 process
#
# Usage:
#   ./scripts/deploy_ec2_backend.sh <repo-url>
#
# Optional environment variables:
#   APP_DIR=/home/ec2-user/Medical-Document-Processing-AI-Agent
#   BRANCH=main
#   APP_NAME=medical-docs-api

REPO_URL="${1:-}"
APP_DIR="${APP_DIR:-$HOME/Medical-Document-Processing-AI-Agent}"
BRANCH="${BRANCH:-main}"
APP_NAME="${APP_NAME:-medical-docs-api}"
BACKEND_DIR="${APP_DIR}/backend"

if [[ -z "${REPO_URL}" && ! -d "${APP_DIR}/.git" ]]; then
  echo "Usage: $0 <repo-url>"
  echo "Example: $0 git@github.com:org/Medical-Document-Processing-AI-Agent.git"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node.js 20+ first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found. Install Node.js/npm first."
  exit 1
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "Cloning repository into ${APP_DIR} ..."
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
  echo "Updating repository in ${APP_DIR} ..."
  git -C "${APP_DIR}" fetch origin "${BRANCH}"
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
fi

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "Backend directory not found: ${BACKEND_DIR}"
  exit 1
fi

cd "${BACKEND_DIR}"

if [[ ! -f ".env" ]]; then
  echo "Missing backend/.env. Create it before deploying."
  echo "Required at minimum: SUPABASE_URL, SUPABASE_SERVICE_KEY, AZURE/GEMINI keys, CORS_ORIGINS."
  exit 1
fi

echo "Installing dependencies..."
npm ci

echo "Building backend..."
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 not found. Installing globally..."
  npm install -g pm2
fi

echo "Restarting PM2 app: ${APP_NAME} ..."
pm2 delete "${APP_NAME}" >/dev/null 2>&1 || true

if [[ -f "ecosystem.config.cjs" ]]; then
  pm2 start ecosystem.config.cjs --update-env
else
  pm2 start dist/main.js --name "${APP_NAME}" --update-env
fi

pm2 save

echo
echo "Deployment complete."
echo "Check status: pm2 status"
echo "Check logs:   pm2 logs ${APP_NAME}"
echo "Health:       curl http://127.0.0.1:3000/health"
