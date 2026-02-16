# Medical Document AI Frontend - Medical Document Processing UI

React/Next.js frontend for the medical document processing AI system.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: React hooks (no external state management needed for MVP)

## Features

### Pages

1. **Home (`/`)** - Landing page with system overview
2. **Upload (`/upload`)** - Drag & drop document upload with progress tracking
3. **Review Queue (`/review`)** - List of documents awaiting review with confidence scoring
4. **Review Detail (`/review/[id]`)** - Detailed document review with extraction form

### Key Features

- ✅ Drag-and-drop file upload (PDF/DOCX)
- ✅ Real-time upload progress with pipeline stages
- ✅ Confidence score visualization (green/yellow/red badges)
- ✅ Editable extraction form with all 7 medical fields
- ✅ Save draft, approve, and reject workflows
- ✅ Responsive design
- ✅ Error handling and loading states

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:3000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will run on `http://localhost:3002` (port 3000 is used by backend).

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Project Structure

```
frontend/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx        # Home page
│   │   ├── upload/         # Upload page
│   │   ├── review/         # Review queue & detail pages
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── components/         # Reusable React components (future)
│   ├── lib/
│   │   ├── api.ts          # Backend API client
│   │   └── utils.ts        # Utility functions
│   └── types/
│       └── index.ts        # TypeScript type definitions
├── public/                 # Static assets
└── package.json
```

## API Integration

The frontend communicates with the NestJS backend via the API client (`src/lib/api.ts`):

### Available Endpoints

- `POST /documents/process` - Upload and process document
- `GET /documents/:id` - Get document details
- `GET /documents/queue/review` - Get review queue
- `POST /documents/:id/update` - Update extracted data
- `POST /documents/:id/approve` - Approve document
- `POST /documents/:id/reject` - Reject document

## Data Flow

1. User uploads document → Backend processes (OCR + AI)
2. Document appears in review queue with confidence scores
3. User reviews and edits extracted fields
4. User approves → Document marked as completed
5. Backend ready for PMS import

## Confidence Scoring

- **Green (>90%)**: High confidence - auto-approve eligible
- **Yellow (70-90%)**: Medium confidence - review recommended
- **Red (<70%)**: Low confidence - manual review required

## Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start

# Recommended: Deploy to Vercel
# Connect GitHub repo → Auto-deploy on push
```

## Future Enhancements

- [ ] PDF viewer integration (react-pdf)
- [ ] Form validation with zod + react-hook-form
- [ ] Dark mode support
- [ ] Dashboard with statistics
- [ ] Document history/audit log page
- [ ] Keyboard shortcuts
- [ ] Batch upload support
- [ ] Real-time status updates (WebSocket/SSE)

## Development Notes

- Backend must be running on port 3000 for API calls to work
- Frontend runs on port 3002 to avoid conflicts
- All pages are client-side rendered (`'use client'`) for simplicity
- No authentication implemented yet (planned for Phase 3)

## Troubleshooting

**Port already in use:**
```bash
# Kill process on port 3002
lsof -ti:3002 | xargs kill -9
```

**API connection errors:**
- Verify backend is running on http://localhost:3000
- Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
- Check browser console for CORS errors

**Build errors:**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```
