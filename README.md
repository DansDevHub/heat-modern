# DSD Viewer Modernization — Starter Repo (Option B)

This repo is a **starter scaffold** for modernizing the legacy Dojo/Web AppBuilder (WAB) app into a modern web stack while preserving the “Results” workflow.

## What this starter gives you
- **Frontend**: React + TypeScript + Vite + ArcGIS Maps SDK for JavaScript (`@arcgis/core`)
- **Backend (optional)**: Node/Express API for proxying ArcGIS requests, adding auth later, and encapsulating “results widget” query orchestration
- **Shared types** for parcel + results payloads
- A clear place to port legacy logic (e.g., `doParcelQuery`, buffer, multi-layer queries, PDF export)

## Prereqs
- Node 18+ (Node 20 LTS recommended)

## Quick start
```bash
npm install
npm run dev
```

This runs:
- web: http://localhost:5173
- api: http://localhost:8787

## Where to port legacy functionality
- Parcel selection + folio lookup: `apps/api/src/services/parcelService.ts`
- Multi-layer “results table” assembly: `apps/api/src/services/resultsAggregator.ts`
- Results panel UI: `apps/web/src/features/results/ResultsPanel.tsx`
- Map click plumbing: `apps/web/src/features/map/MapView.tsx`

## Configuration
Place your app config (the one you exported from WAB) at:
- `apps/web/public/config/config.json`

This starter reads a small subset (portalUrl + webmap itemId) and ignores the rest for now.
