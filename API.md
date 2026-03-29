# API Design

This file is the source of truth for API route structure and response shapes.

## Overview

Two layers:
- **REST** — resource fetching, filtering, pagination. Answers "give me data."
- **Analytics** — pre-computed, cached, investment-focused. Answers "what should I do."

Cache strategy: Postgres materialized views refreshed nightly.

Base URL: `http://localhost:4000`

---

## Standard Endpoints

### `GET /health`

Liveness check. Used by Docker, load balancers, and CI to confirm the server is up.

```json
{
  "status": "ok",
  "timestamp": "2026-03-29T00:00:00.000Z",
  "uptime_seconds": 3412
}
```

---

### `GET /health/db`

Readiness check. Confirms the server is up **and** the database connection is healthy. Use this for startup probes — don't route traffic until this returns `200`.

```json
{
  "status": "ok",
  "db": "connected",
  "timestamp": "2026-03-29T00:00:00.000Z"
}
```

Returns `503` if the DB is unreachable.

---

### `GET /api`

API index. Returns the available resource routes and current API version. Useful for frontend devs and debugging — one call to see what's mounted.

```json
{
  "version": "1.0.0",
  "resources": [
    "GET /api/vendors",
    "GET /api/awards",
    "GET /api/agencies",
    "GET /api/naics"
  ],
  "analytics": [
    "GET /api/analytics/investment-scores",
    "GET /api/analytics/emerging-winners",
    "GET /api/analytics/risk-profile/:cage_code",
    "GET /api/analytics/sector-heatmap",
    "GET /api/analytics/win-rate/:cage_code",
    "GET /api/analytics/geographic-clustering"
  ]
}
```

---

## Error Shape

All errors return a consistent envelope so the frontend never has to guess the structure.

| Status | Meaning |
|---|---|
| `400` | Bad request — invalid or missing query params |
| `404` | Resource not found |
| `429` | Rate limited |
| `500` | Unexpected server error |

```json
{
  "error": {
    "status": 404,
    "message": "Vendor with CAGE code XYZ99 not found"
  }
}
```

---

## REST Endpoints

### Vendors

#### `GET /api/vendors`

**Filters**

| Param | Type | Description |
|---|---|---|
| `search` | string | Name search (trigram) |
| `state_code` | string | e.g. `VA` |
| `country_code` | string | e.g. `USA` |
| `small_business_flag` | boolean | `true` / `false` |
| `parent_cage` | string | Filter by parent company CAGE code |

**Sort:** `?sort=name|annual_revenue|number_of_employees&order=asc|desc`

```json
{
  "data": [{
    "cage_code": "CA12",
    "uei": "K21BNJGB9US6",
    "name": "INDYNE, INC",
    "state_code": "VA",
    "country_code": "USA",
    "small_business_flag": true,
    "annual_revenue": null,
    "number_of_employees": 80,
    "parent_cage": null,
    "registration_date": "2009-12-14"
  }],
  "pagination": { "page": 1, "limit": 25, "total": 84201, "totalPages": 3369 }
}
```

---

#### `GET /api/vendors/:cage_code`

CAGE code is the primary identifier. UEI included as a secondary field. Includes aggregate stats joined from awards.

```json
{
  "cage_code": "CA12",
  "uei": "K21BNJGB9US6",
  "name": "INDYNE, INC",
  "state_code": "VA",
  "country_code": "USA",
  "small_business_flag": true,
  "annual_revenue": null,
  "number_of_employees": 80,
  "parent_cage": null,
  "registration_date": "2009-12-14",
  "award_count": 14,
  "total_obligated": 778301555.26
}
```

---

#### `GET /api/vendors/:cage_code/awards`

Same shape as `GET /api/awards` scoped to this vendor.

---

### Awards

#### `GET /api/awards`

**Filters**

| Param | Type | Description |
|---|---|---|
| `year` | number | Fiscal year |
| `agency_code` | string | e.g. `9700` |
| `naics_code` | string | e.g. `517110` |
| `state_code` | string | Place of performance |
| `award_type` | string | e.g. `DEFINITIVE CONTRACT` |
| `set_aside_type` | string | e.g. `SBA` |
| `extent_competed` | string | e.g. `D` |
| `search` | string | Searches description field |

**Sort:** `?sort=dollars_obligated|date_signed&order=asc|desc`

```json
{
  "data": [{
    "piid": "F0468403C0050",
    "modification_number": "P00279",
    "dollars_obligated": 108164.41,
    "date_signed": "2009-12-14",
    "award_type": "DEFINITIVE CONTRACT",
    "naics_code": "517110",
    "naics_description": "WIRED TELECOMMUNICATIONS CARRIERS",
    "product_or_service_code": "R426",
    "agency_code": "9700",
    "agency_name": "DEPT OF DEFENSE",
    "state_code": "CA",
    "set_aside_type": "SBA",
    "extent_competed": "D",
    "vendor_cage": "CA12",
    "vendor_uei": "K21BNJGB9US6",
    "vendor_name": "INDYNE, INC"
  }],
  "pagination": { "page": 1, "limit": 25, "total": 12000, "totalPages": 480 }
}
```

---

### Agencies

#### `GET /api/agencies`

```json
{
  "data": [{
    "code": "9700",
    "name": "DEPT OF DEFENSE",
    "award_count": 45210,
    "total_obligated": 9200000000.00
  }],
  "pagination": { "page": 1, "limit": 25, "total": 80, "totalPages": 4 }
}
```

#### `GET /api/agencies/:code/awards`
Same shape as `GET /api/awards` scoped to this agency.

#### `GET /api/agencies/:code/vendors`
Same shape as `GET /api/vendors` scoped to vendors who received awards from this agency.

---

### NAICS

#### `GET /api/naics`

```json
{
  "data": [{
    "code": "517110",
    "name": "WIRED TELECOMMUNICATIONS CARRIERS",
    "award_count": 1203,
    "total_obligated": 450000000.00
  }],
  "pagination": { "page": 1, "limit": 25, "total": 400, "totalPages": 16 }
}
```

#### `GET /api/naics/:code/awards`
Same shape as `GET /api/awards` scoped to this NAICS code.

#### `GET /api/naics/:code/vendors`
Same shape as `GET /api/vendors` scoped to vendors in this NAICS code.

---

## Best Practices

| Concern | Approach |
|---|---|
| SQL injection | Parameterized queries + whitelisted sort columns |
| Performance | Indexes on `cage_code`, `uei`, `agency_code`, `naics_code`, `date_signed`, `dollars_obligated`, `state_code` |
| Full-text search | `pg_trgm` GIN index on `vendor.name` and `award.description` |
| Deep pagination | Keyset/cursor pagination for large offsets |
| `COUNT(*)` cost | Run count query in parallel with data query only when needed |
| Schema | Drop old `companies` table, replace with `vendors` + `awards` keyed on `cage_code` (UEI as secondary) |
| Validation | Sanitize and validate all query params before SQL |
| Consistent envelope | All lists return `{ data, pagination }`, single resources return flat object |
| HTTP semantics | `404` on missing resource, `400` on bad params, `500` only for unexpected errors |

---

## Analytics Endpoints

Pre-computed, cached, investment-focused. Directly answer **"what company should I invest in?"**

All responses include a `cached_at` timestamp. Filters are coarse — no arbitrary sorting.

Cache TTL: **24h** (materialized views refreshed nightly).

---

### `GET /api/analytics/investment-scores`

**Why this endpoint exists:**
No single metric tells you who to invest in. This endpoint combines award velocity, contract value growth, agency diversification, and set-aside graduation into one composite score — so the frontend can render a ranked leaderboard without making 4 separate REST calls and doing math in the browser. The score is the product, not the raw data.

**Frontend use:** Drive a ranked table like "Top 10 Companies to Watch This Year." Each row links to the vendor detail page. The `score_breakdown` object lets you show a tooltip explaining why a company ranked where it did.

**Filters:** `?year=`, `?state_code=`, `?naics_code=`, `?small_business_flag=`, `?limit=` (max 50)

```json
{
  "year": 2010,
  "data": [
    {
      "rank": 1,
      "cage_code": "CA12",
      "uei": "K21BNJGB9US6",
      "name": "INDYNE, INC",
      "state_code": "VA",
      "composite_score": 87.4,
      "score_breakdown": {
        "award_velocity": 92.0,
        "contract_value_growth": 88.5,
        "agency_diversification": 76.0,
        "setaside_graduation": 93.0
      },
      "total_obligated": 778301555.26,
      "award_count": 14
    }
  ],
  "cached_at": "2026-03-29T00:00:00.000Z"
}
```

---

### `GET /api/analytics/emerging-winners`

**Why this endpoint exists:**
The REST `GET /api/vendors` list can surface new vendors, but it has no concept of "breakthrough." This endpoint specifically identifies companies that either appeared for the first time this year OR had a significant jump in contract value after years of small awards — the "breakout" moment. That distinction requires cross-year aggregation that is too expensive to do per-request.

**Frontend use:** A "New to Watch" card section on the dashboard. Investors want early signals before a company is well-known. This is that signal.

**Filters:** `?year=`, `?min_obligated=`, `?state_code=`, `?naics_code=`, `?limit=` (max 50)

```json
{
  "year": 2010,
  "data": [
    {
      "cage_code": "CA12",
      "uei": "K21BNJGB9US6",
      "name": "INDYNE, INC",
      "state_code": "VA",
      "is_first_ever_award": true,
      "first_award_date": "2010-01-15",
      "award_count": 3,
      "total_obligated": 4200000.00,
      "prev_year_obligated": 0,
      "growth_pct": null,
      "naics_code": "517110",
      "naics_name": "WIRED TELECOMMUNICATIONS CARRIERS",
      "agency_name": "DEPT OF DEFENSE"
    }
  ],
  "cached_at": "2026-03-29T00:00:00.000Z"
}
```

---

### `GET /api/analytics/risk-profile/:cage_code`

**Why this endpoint exists:**
This is a per-company endpoint but still analytics — not a REST resource. It requires joining awards, grouping by agency, counting contract types, and computing modification ratios for a single vendor. Doing this in real-time would be slow. It's pre-computed per vendor nightly. The frontend can't derive this from `GET /api/vendors/:cage_code` alone.

**Frontend use:** A "Risk Profile" panel on the vendor detail page. Shows investors the downside — what could go wrong before they commit.

**No filters** — scoped to one vendor by CAGE code.

```json
{
  "cage_code": "CA12",
  "uei": "K21BNJGB9US6",
  "name": "INDYNE, INC",
  "agency_concentration": [
    {
      "agency_code": "5700",
      "agency_name": "DEPT OF THE AIR FORCE",
      "obligated": 620000000.00,
      "pct_of_total": 79.7
    },
    {
      "agency_code": "9700",
      "agency_name": "DEPT OF DEFENSE",
      "obligated": 158301555.26,
      "pct_of_total": 20.3
    }
  ],
  "contract_type_breakdown": [
    { "type": "COST PLUS INCENTIVE FEE", "count": 8, "pct": 57.1 },
    { "type": "FIRM FIXED PRICE", "count": 6, "pct": 42.9 }
  ],
  "modification_health": {
    "total_contracts": 14,
    "total_modifications": 42,
    "avg_modifications_per_contract": 3.0,
    "high_mod_contracts": 3
  },
  "cached_at": "2026-03-29T00:00:00.000Z"
}
```

---

### `GET /api/analytics/sector-heatmap`

**Why this endpoint exists:**
Investors don't just pick companies — they pick sectors first, then companies within them. This endpoint aggregates total government spend by NAICS code and surfaces the top vendors per sector in a single response. Doing this with REST would require one call to `/api/naics`, then N calls to `/api/naics/:code/vendors` — one per sector. That's a waterfall. This collapses it into one cached response.

**Frontend use:** A heatmap or treemap visualization. Click a sector to drill down to its top vendors. Drives the "sector-first" investment workflow.

**Filters:** `?year=`, `?agency_code=`, `?limit=` (max sectors: 20, top vendors per sector: 5)

```json
{
  "year": 2010,
  "data": [
    {
      "naics_code": "517110",
      "naics_name": "WIRED TELECOMMUNICATIONS CARRIERS",
      "total_obligated": 450000000.00,
      "award_count": 1203,
      "yoy_growth_pct": 18.4,
      "top_vendors": [
        {
          "cage_code": "CA12",
          "uei": "K21BNJGB9US6",
          "name": "INDYNE, INC",
          "total_obligated": 778301555.26,
          "market_share_pct": 22.4
        }
      ]
    }
  ],
  "cached_at": "2026-03-29T00:00:00.000Z"
}
```

---

### `GET /api/analytics/win-rate/:cage_code`

**Why this endpoint exists:**
Win rate is a derived metric — it requires counting competed awards where the vendor won vs. total solicitations they appear in, using `extent_competed`, `number_of_offers_received`, and `set_aside_type`. This cannot be computed from a simple REST query. A high competitive win rate means the government keeps choosing this company over others — that is a strong signal of operational excellence and contract moat.

**Frontend use:** A "Competitive Strength" badge or chart on the vendor detail page. Differentiates lucky sole-source winners from companies that genuinely outcompete.

**Filters:** `?year=` (defaults to current year)

```json
{
  "cage_code": "CA12",
  "uei": "K21BNJGB9US6",
  "name": "INDYNE, INC",
  "year": 2010,
  "total_awards": 14,
  "competed_awards": 10,
  "sole_source_awards": 4,
  "competitive_win_rate_pct": 71.4,
  "avg_offers_received": 2.8,
  "setaside_history": [
    { "year": 2008, "type": "SBA", "label": "SMALL BUSINESS SET ASIDE - TOTAL" },
    { "year": 2009, "type": "SBA", "label": "SMALL BUSINESS SET ASIDE - TOTAL" },
    { "year": 2010, "type": "NONE", "label": "NO SET ASIDE USED" }
  ],
  "graduated_from_setaside": true,
  "cached_at": "2026-03-29T00:00:00.000Z"
}
```

---

### `GET /api/analytics/geographic-clustering`

**Why this endpoint exists:**
Federal contracting is heavily geographic — defense corridors (VA, CA, TX) concentrate enormous spend. This endpoint groups award winners by state and congressional district and surfaces the dominant vendors per region. A REST query on `/api/vendors?state_code=VA` gives you vendors in VA, but it can't tell you which ones *dominate* their region or how that region's total spend compares nationally. This endpoint answers both in one shot.

**Frontend use:** A choropleth map of the US. Each state shows total obligated spend. Clicking a state reveals the top vendors there. Useful for investors targeting regional defense-corridor growth.

**Filters:** `?year=`, `?state_code=` (narrow to one state), `?naics_code=`, `?limit=` (max vendors per region: 5)

```json
{
  "year": 2010,
  "data": [
    {
      "state_code": "VA",
      "state_name": "VIRGINIA",
      "total_obligated": 12400000000.00,
      "award_count": 28400,
      "pct_of_national_total": 14.2,
      "top_vendors": [
        {
          "cage_code": "CA12",
          "uei": "K21BNJGB9US6",
          "name": "INDYNE, INC",
          "total_obligated": 778301555.26,
          "regional_market_share_pct": 6.3
        }
      ],
      "top_congressional_districts": [
        { "district": "VA-08", "total_obligated": 4200000000.00 }
      ]
    }
  ],
  "cached_at": "2026-03-29T00:00:00.000Z"
}
```
