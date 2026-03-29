# Sales Patriot Team Project

200 GB of DLA award data tracking revenue and contracts awarded to companies over time.

- **Backend** — server, API, data upload
- **Frontend** — data display, file upload UI

The backend sends column headers to the frontend so the frontend can render tables dynamically without hardcoded field names. CAGE code is the primary company identifier.

**Core question this app answers:** What companies should I invest in? Surface the top CAGE codes by award volume for a given year.

---

## Getting Started

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Set up environment
cd ../backend && cp .env.example .env

# 3. Start Postgres (via Docker)
cd .. && docker compose up postgres -d

# 4. Initialize the database schema
cd backend && npm run db:init

# 5. Load a sample file or the mounted USB data (optional but recommended)
npm run db:import -- ../data/awards_20100314_20100314.csv
# or
npm run db:import -- /Volumes/USB

# 6. Start backend (new terminal)
npm run dev

# 7. Start frontend (new terminal)
cd ../frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend API | Node.js + Express |
| Database | PostgreSQL |
| Frontend | React + Vite + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS |
| File Uploads | Multer + batch CSV importer |
| Logging | Winston |
| CI | GitHub Actions |
| Infrastructure | Docker Compose |

---

## API

Full API design is documented in [API.md](./API.md).

Current implemented backend routes:

```text
GET /health

GET /api/companies
  ?page=1&limit=25
  ?search=indyne

GET /api/companies/:cageCode

GET /api/awards/headers

GET /api/awards
  ?page=1&limit=25
  ?sortBy=award_amount
  ?sortDir=desc
  ?cageCode=07MU1

GET /api/awards/:cageCode
  ?page=1&limit=25
  ?sortBy=award_date
  ?sortDir=desc

POST /api/upload
```

---

## Database & Schema

Database design notes for the real CSV exports are in [docs/database-schema.md](./docs/database-schema.md).

Backend Drizzle setup lives in `backend/drizzle.config.mjs` with runtime schema/client files under `backend/src/db/drizzle/`.

The database source of truth is `backend/src/db/schema.sql`. The current read routes query `award_transactions`, `vendor_entities`, and the investment summary views directly.

---

## Team

- **Backend team** — server, API routes, data ingestion, DB schema
- **Frontend team** — display, upload UI, consumes headers from `/api/awards/headers`
