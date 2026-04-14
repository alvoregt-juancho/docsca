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
Mobile app (Android APK) that photographs book pages, processes them with Gemini AI OCR, sorts by detected page number, and exports to Word (.docx), OCR PDF, and Scan PDF.

### Architecture
- **Backend** (`artifacts/api-server`): Express 5 + ESM. Handles OCR via Gemini 2.5 Flash (vision), document generation (docx + pdfkit), and file downloads.
- **Mobile** (`artifacts/mobile`): Expo SDK 54 + React Native. Camera → auto-crop to frame → batch capture → OCR upload → page management → document download.
- **OCR Engine**: Gemini 2.5 Flash via Replit AI Integrations proxy (no user API keys needed). The model analyzes images, extracts text, and detects page numbers.

### Key Files
- `artifacts/api-server/src/lib/geminiOcr.ts` — Gemini AI vision OCR (real text extraction + page number detection)
- `artifacts/api-server/src/lib/tempStorage.ts` — File-based page storage + page number interpolation logic
- `artifacts/api-server/src/lib/wordGenerator.ts` — docx generation with per-page footers
- `artifacts/api-server/src/lib/pdfGenerator.ts` — PDF generation with pdfkit
- `artifacts/api-server/src/lib/scanPdfGenerator.ts` — Scan PDF generation (images only)
- `artifacts/mobile/context/ProjectContext.tsx` — Global state: projects + pages + AsyncStorage persistence
- `artifacts/mobile/services/api.ts` — API client for backend endpoints
- `artifacts/mobile/app/camera.tsx` — Camera with auto-crop to frame + batch capture mode
- `artifacts/mobile/app/project/[id].tsx` — Project detail: page list, generate, download

### API Endpoints
- `POST /api/ocr` — Upload image, run Gemini AI OCR, return page data
- `POST /api/pages/process` — Legacy page processing endpoint (also uses Gemini)
- `POST /api/documents/generate` — Generate Word + PDF + Scan PDF from all project pages
- `GET /api/documents/:id/download/word` — Download .docx file
- `GET /api/documents/:id/download/pdf` — Download OCR .pdf file
- `GET /api/documents/:id/download/scan` — Download scan .pdf file (images)
- `GET /api/documents/config` — Check if Gemini AI is configured
- `GET /api/healthz` — Server health check

### Environment Variables (Backend)
- `AI_INTEGRATIONS_GEMINI_BASE_URL` — Replit AI Integrations proxy URL (auto-configured)
- `AI_INTEGRATIONS_GEMINI_API_KEY` — Replit AI Integrations API key (auto-configured)

### Camera Features
- Auto-crop to white frame overlay (letter-page aspect ratio)
- Batch capture: take multiple photos quickly, processed in background
- EXIF-aware photo handling
- Photos resized to 1200px wide before upload

### Page Number Interpolation
Pages without detected numbers inherit the nearest preceding numbered page's number in the footer. This allows unnumbered pages (title, separators) to be positioned correctly in the output documents.

### Build & Deploy
- APK built via EAS Build: `eas build -p android --profile preview`
- GitHub remote: `github` (push with `git push github main`)
- EAS account: `alvoregt`
- API domain: `b3c6dadb-c834-4261-8f7a-c211f162114f-00-khhgwmk6ldxz.kirk.replit.dev`
- The workspace must be running when the app is used (dev server stops when workspace sleeps)
- Colors: primary #2563EB, bg #EEF2FF
- SDK 54, newArchEnabled: true, expo-router ~6.0.17
