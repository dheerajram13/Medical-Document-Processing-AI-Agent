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

## Future Scripts

- `setup.sh` - Initial project setup
- `deploy.sh` - Deployment script
- `backup.sh` - Database backup
- `migrate.sh` - Run database migrations
