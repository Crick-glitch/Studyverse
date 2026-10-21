# StudyVerse (rebuild in progress)

Monorepo: `apps/web` (React + Vite), `apps/api` (Express), `packages/shared`. Legacy static app: `Studyverse/`.

    npm install
    cp .env.example .env     # optional; defaults work locally
    npm run dev              # web :5173, api :4000
    npm run typecheck && npm run lint && npm run test && npm run build

Status: Phase 1 foundation only. Every route except `/api/v1/health` is a labeled placeholder. See `docs/AUDIT.md`, `docs/DECISIONS.md`, `docs/HANDOFF.md`.
