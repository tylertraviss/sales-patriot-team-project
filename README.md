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
| Leaderboard | `/leaderboard` | All companies ranked by total obligated |
| Company Profile | `/companies/:cageCode` | Deep dive on a single company |
| Industry Explorer | `/industries` | Browse by NAICS code |
| Awards Feed | `/awards` | Full filterable awards table |

---

## Feature Ideas

**Company Relationship Graph**
A node-based network graph where each company is a node. Edges represent shared contracts, agencies, or NAICS codes. Visualizes which companies are winning awards in relation to each other. Uses the `numberOfOffersReceived` column to show how competitive each node's contracts are — e.g. a company winning sole source contracts (1 offer) vs. a company beating out 15 competitors.

**Opportunity Finder**
Surface contracts where competition is low and dollar value is high — the gaps where a new company could realistically win. Cross-reference extent competed, number of offers received, and award amount to score and rank open opportunities.

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

## Team

- **Backend team** — server, API routes, data ingestion, DB schema
- **Frontend team** — display, upload UI, consumes headers from `/api/awards/headers`