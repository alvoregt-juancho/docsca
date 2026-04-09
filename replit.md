# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: DocScan — Android Document Scanner

### Purpose
Mobile app (Android APK) that photographs book pages, processes them with Google Document AI OCR, sorts by detected page number, and exports to Word (.docx) and PDF.

### Architecture
- **Backend** (`artifacts/api-server`): Express 5 + ESM. Handles OCR (via Document AI or mock data), document generation (docx + pdfkit), and file downloads.
- **Mobile** (`artifacts/mobile`): Expo + React Native. Camera → OCR upload → page management → document download.

### Key Files
- `artifacts/api-server/src/lib/documentAiClient.ts` — Google Document AI integration + mock fallback
- `artifacts/api-server/src/lib/tempStorage.ts` — File-based page storage + page number interpolation logic
- `artifacts/api-server/src/lib/wordGenerator.ts` — docx generation with per-page footers
- `artifacts/api-server/src/lib/pdfGenerator.ts` — PDF generation with pdfkit
- `artifacts/mobile/context/ProjectContext.tsx` — Global state: projects + pages + AsyncStorage persistence
- `artifacts/mobile/services/api.ts` — API client for backend endpoints
- `artifacts/mobile/app/camera.tsx` — Camera screen with document guide overlay
- `artifacts/mobile/app/project/[id].tsx` — Project detail: page list, generate, download

### API Endpoints
- `POST /api/pages/process` — Upload image, run OCR, return page data
- `POST /api/documents/generate` — Generate Word + PDF from all project pages
- `GET /api/documents/:id/download/word` — Download .docx file
- `GET /api/documents/:id/download/pdf` — Download .pdf file
- `GET /api/documents/config` — Check if Google Document AI is configured

### Environment Variables (Backend)
- `GOOGLE_CLOUD_PROJECT_ID` — Google Cloud project ID
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` — Document OCR processor ID
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` — Service account key JSON (full content)
- `GOOGLE_CLOUD_LOCATION` — Processor region (default: "us")

Without these, the app uses mock OCR data for testing.

### Page Number Interpolation
Pages without detected numbers inherit the nearest preceding numbered page's number in the footer. This allows unnumbered pages (title, separators) to be positioned correctly in the output documents.
