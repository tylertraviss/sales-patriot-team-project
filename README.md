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

# 5. Start backend (new terminal)
npm run dev

# 6. Start frontend (new terminal)
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
| File Uploads | Multer (CSV streaming to DB) |
| Logging | Winston |
| CI | GitHub Actions |
| Infrastructure | Docker Compose |

---

## API Reference

### Vendors

```
GET /api/vendors
  ?page=1&limit=25
  ?sort=totalObligated&order=desc
  ?year=2010
  ?naicsCode=517110
  ?stateCode=VA
  ?agencyCode=9700
  ?setAsideType=SBA
  ?search=indyne

GET /api/vendors/:uei
GET /api/vendors/:uei/awards
  ?page=1&limit=25
  ?sort=dollarsObligated&order=desc
  ?year=2010
  ?agencyCode=9700
  ?awardType=DEFINITIVE+CONTRACT

GET /api/vendors/:uei/awards/summary
```

### Awards

```
GET /api/awards
  ?page=1&limit=25
  ?sort=dollarsObligated&order=desc
  ?year=2010
  ?agencyCode=9700
  ?naicsCode=517110
  ?stateCode=CA
  ?awardType=DEFINITIVE+CONTRACT
  ?extentCompeted=D
  ?search=communications
```

### Agencies

```
GET /api/agencies
  ?page=1&limit=25
  ?sort=name&order=asc

GET /api/agencies/:code/awards
  ?page=1&limit=25
  ?sort=dollarsObligated&order=desc
  ?year=2010

GET /api/agencies/:code/vendors
  ?page=1&limit=25
  ?sort=totalObligated&order=desc
```

### NAICS

```
GET /api/naics
  ?page=1&limit=25
  ?sort=totalObligated&order=desc

GET /api/naics/:code/awards
  ?page=1&limit=25
  ?year=2010

GET /api/naics/:code/vendors
  ?page=1&limit=25
```

### Pagination Envelope

Every paginated endpoint returns:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 84201,
    "totalPages": 3369
  }
}
```

---

## Database & Schema

Database design notes for the real CSV exports are in [docs/database-schema.md](./docs/database-schema.md).

Backend Drizzle setup lives in `backend/drizzle.config.mjs` with runtime schema/client files under `backend/src/db/drizzle/`.

---

## Team

- **Backend team** — server, API routes, data ingestion, DB schema
- **Frontend team** — display, upload UI, consumes headers from `/api/awards/headers`
