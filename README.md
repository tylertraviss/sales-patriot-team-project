# Sales Patriot Team Project

200 GB of DLA award data tracking revenue and contracts awarded to companies over time.

- **Backend** — server, API, data upload
- **Frontend** — data display, file upload UI

The backend sends column headers to the frontend so the frontend can render tables dynamically without hardcoded field names. **CAGE code is the primary company identifier.** UEI is a secondary attribute.

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
| Frontend | React + Vite + Tailwind CSS |
| Charts | Recharts |
| File Uploads | Multer (CSV streaming to DB) |
| Logging | Winston |
| CI | GitHub Actions |
| Infrastructure | Docker Compose |

---

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Overview charts, top earners, awards table |
| Vendors | `/vendors` | All vendors ranked by total obligated |
| Vendor Profile | `/vendors/:cageCode` | Deep dive on a single vendor |
| Industry Explorer | `/industries` | Browse by NAICS code |
| Awards Feed | `/awards` | Full filterable awards table |
| Sector Graph | `/graph` | Force-directed NAICS competitor network |

---

## API Reference

All responses use **camelCase** field names. All list endpoints return a `{ data, pagination }` envelope.

### Vendors

```
GET /api/vendors
  ?page=1&limit=25
  ?sort=total_obligated&order=desc
  ?year=2010
  ?naics_code=517110
  ?state_code=VA
  ?agency_code=9700
  ?set_aside_code=SBA
  ?search=indyne

GET /api/vendors/:cage_code
GET /api/vendors/:cage_code/awards
  ?page=1&limit=25
  ?sort=award_amount&order=desc

GET /api/vendors/:cage_code/awards/summary
```

### Awards

```
GET /api/awards/headers
GET /api/awards
  ?page=1&limit=25
  ?sort=award_amount&order=desc
  ?year=2010
  ?agency_code=9700
  ?naics_code=517110
  ?state_code=CA
  ?award_type=DEFINITIVE+CONTRACT
  ?extent_competed=D
  ?search=communications
```

### Agencies

```
GET /api/agencies
  ?page=1&limit=25
  ?sort=total_obligated&order=asc

GET /api/agencies/:code/awards
GET /api/agencies/:code/vendors
```

### NAICS

```
GET /api/naics
  ?page=1&limit=25
  ?sort=total_obligated&order=desc

GET /api/naics/graph
GET /api/naics/:code/awards
GET /api/naics/:code/vendors
```

### Analytics

```
GET /api/analytics/kpi
GET /api/analytics/investment-scores
GET /api/analytics/emerging-winners
GET /api/analytics/risk-profile/:cage_code
GET /api/analytics/sector-heatmap
GET /api/analytics/win-rate/:cage_code
GET /api/analytics/geographic-clustering
```

### Health

```
GET /health
GET /health/db
```

---

## Team

- **Backend team** — server, API routes, data ingestion, DB schema
- **Frontend team** — display, upload UI, consumes headers from `/api/awards/headers`
