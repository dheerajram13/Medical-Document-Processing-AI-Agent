# Scripts Directory

Utility scripts for development and deployment.

## Available Scripts

### Security

- **verify_security.sh** - Pre-commit security check
  ```bash
  ./scripts/verify_security.sh
  ```
  Verifies:
  - `.env` is gitignored
  - Service account JSONs are gitignored
  - No API keys in tracked files
  - `.env.example` has placeholders only

### Deployment

- **deploy_ec2_backend.sh** - Deploy/update backend on EC2 with PM2
  ```bash
  ./scripts/deploy_ec2_backend.sh <repo-url>
  ```
  Performs:
  - clone/pull repo
  - `npm ci`
  - `npm run build`
  - PM2 restart for `medical-docs-api`

- **nginx/medical-docs-api.conf** - NGINX reverse-proxy template
  - Proxies `:80` to backend `127.0.0.1:3000`

## Future Scripts

- `setup.sh` - Initial project setup
- `backup.sh` - Database backup
- `migrate.sh` - Run database migrations
