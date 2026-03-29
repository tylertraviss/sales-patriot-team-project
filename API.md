# API Design

This file is the source of truth for API route structure and response shapes.

## Overview

Two layers:
- **REST** — resource fetching, filtering, pagination. Answers "give me data."
- **Analytics** — pre-computed, cached, investment-focused. Answers "what should I do."

Cache strategy: Postgres materialized views refreshed nightly.

Base URL: `http://localhost:4000`

All JSON responses use **camelCase** field names. All list endpoints return a `{ data, pagination }` envelope.

**CAGE code is the primary vendor identifier.** UEI is a secondary attribute included where available.

---

## Standard Endpoints

### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-03-29T00:00:00.000Z", "uptime_seconds": 3412 }
```

### `GET /health/db`

Confirms the DB connection is healthy. Returns `503` if unreachable.

```json
{ "status": "ok", "db": "connected", "timestamp": "2026-03-29T00:00:00.000Z" }
```

### `GET /api`

API index — returns mounted routes and version.

---

## Error Shape

```json
{ "error": { "status": 404, "message": "Vendor with CAGE code XYZ99 not found" } }
```

| Status | Meaning |
|---|---|
| `400` | Bad request |
| `404` | Resource not found |
| `500` | Unexpected server error |

---

## REST Endpoints

### Vendors

#### `GET /api/vendors`

**Filters**

| Param | Type | Description |
|---|---|---|
| `search` | string | Name search |
| `state_code` | string | e.g. `VA` |
| `country_code` | string | e.g. `USA` |
| `naics_code` | string | e.g. `517110` |
| `agency_code` | string | e.g. `9700` |
| `set_aside_code` | string | e.g. `SBA` |
| `year` | number | Fiscal year |

**Sort:** `?sort=name|annual_revenue|number_of_employees|total_obligated|award_count&order=asc|desc`

```json
{
  "data": [{
    "cageCode": "CA12",
    "uei": "K21BNJGB9US6",
    "name": "INDYNE, INC",
    "stateCode": "VA",
    "countryCode": "USA",
    "socioEconomicIndicator": "27",
    "annualRevenue": null,
    "numberOfEmployees": 80,
    "registrationDate": "2009-12-14",
    "awardCount": 14,
    "totalObligated": 778301555.26
  }],
  "pagination": { "page": 1, "limit": 25, "total": 84201, "totalPages": 3369 }
}
```

#### `GET /api/vendors/:cage_code`

CAGE code is the primary identifier. Same shape as a single item from the list above.

#### `GET /api/vendors/:cage_code/awards`

**Sort:** `?sort=award_amount|award_date|date_signed&order=asc|desc`

```json
{
  "data": [{
    "piid": "F0468403C0050",
    "modificationNumber": "P00279",
    "dollarsObligated": 108164.41,
    "awardDate": "2009-12-14",
    "dateSigned": "2009-12-14",
    "awardType": "DEFINITIVE CONTRACT",
    "naicsCode": "517110",
    "naicsDescription": "WIRED TELECOMMUNICATIONS CARRIERS",
    "productServiceCode": "R426",
    "agencyCode": "9700",
    "agencyName": "DEPT OF DEFENSE",
    "stateCode": "CA",
    "setAsideCode": "SBA",
    "setAsideName": "SMALL BUSINESS SET ASIDE - TOTAL",
    "extentCompetedCode": "D",
    "extentCompetedName": "FULL AND OPEN COMPETITION",
    "description": "..."
  }],
  "pagination": { "page": 1, "limit": 25, "total": 14, "totalPages": 1 }
}
```

#### `GET /api/vendors/:cage_code/awards/summary`

```json
{
  "cageCode": "CA12",
  "totalObligated": 778301555.26,
  "awardCount": 14,
  "byYear": [{ "fiscalYear": 2010, "totalObligated": 108164.41, "awardCount": 3 }],
  "byAgency": [{ "agencyCode": "9700", "agencyName": "DEPT OF DEFENSE", "totalObligated": 620000000.00, "awardCount": 10 }],
  "byCompetition": [{ "extentCompetedCode": "D", "extentCompetedName": "FULL AND OPEN COMPETITION", "awardCount": 8, "totalObligated": 500000000.00 }]
}
```

---

### Awards

#### `GET /api/awards/headers`

Returns static column definitions for the awards table.

```json
{
  "headers": [
    { "key": "piid",             "label": "Contract ID", "type": "text"     },
    { "key": "dollarsObligated", "label": "Obligated",   "type": "currency" },
    { "key": "dateSigned",       "label": "Date Signed", "type": "date"     }
  ]
}
```

#### `GET /api/awards`

**Filters**

| Param | Type | Description |
|---|---|---|
| `year` | number | Fiscal year |
| `agency_code` | string | e.g. `9700` |
| `naics_code` | string | e.g. `517110` |
| `state_code` | string | Place of performance |
| `award_type` | string | e.g. `DEFINITIVE CONTRACT` |
| `set_aside_code` | string | e.g. `SBA` |
| `extent_competed` | string | e.g. `D` |
| `search` | string | Searches description field |

**Sort:** `?sort=award_amount|award_date|date_signed&order=asc|desc`

Same row shape as `/api/vendors/:cage_code/awards` plus `vendorCage`, `vendorUei`, `vendorName`.

---

### Agencies

#### `GET /api/agencies`

```json
{
  "data": [{ "code": "9700", "name": "DEPT OF DEFENSE", "awardCount": 45210, "totalObligated": 9200000000.00 }],
  "pagination": { "page": 1, "limit": 25, "total": 80, "totalPages": 4 }
}
```

#### `GET /api/agencies/:code/awards`
#### `GET /api/agencies/:code/vendors`

---

### NAICS

#### `GET /api/naics`

```json
{
  "data": [{ "code": "517110", "name": "WIRED TELECOMMUNICATIONS CARRIERS", "awardCount": 1203, "totalObligated": 450000000.00 }],
  "pagination": { "page": 1, "limit": 25, "total": 400, "totalPages": 16 }
}
```

#### `GET /api/naics/graph`

Returns a force-graph payload for the Sector Competitor Network page.

```json
{
  "nodes": [
    { "id": "naics_517110", "type": "naics", "naicsCode": "517110", "label": "WIRED TELECOMMUNICATIONS CARRIERS", "vendorCount": 12, "totalObligated": 450000000.00 },
    { "id": "vendor_CA12", "type": "vendor", "cageCode": "CA12", "uei": "K21BNJGB9US6", "label": "INDYNE, INC", "stateCode": "VA", "totalObligated": 778301555.26, "awardCount": 14, "competition": "sole" }
  ],
  "links": [{ "source": "naics_517110", "target": "vendor_CA12" }],
  "sectors": [{ "code": "517110", "description": "WIRED TELECOMMUNICATIONS CARRIERS", "vendorCount": 12 }]
}
```

#### `GET /api/naics/:code/awards`
#### `GET /api/naics/:code/vendors`

---

## Analytics Endpoints

All responses use camelCase. All include a `cachedAt` timestamp.

### `GET /api/analytics/kpi`

Dashboard headline numbers.

```json
{
  "totalObligated": 1610000000.00,
  "totalAwards": 4116,
  "totalVendors": 2379,
  "soleSourcePct": 8.4
}
```

### `GET /api/analytics/investment-scores`

**Filters:** `?year=`, `?state_code=`, `?naics_code=`, `?limit=` (max 50)

```json
{
  "year": 2010,
  "data": [{
    "rank": 1,
    "cageCode": "CA12",
    "uei": "K21BNJGB9US6",
    "name": "INDYNE, INC",
    "stateCode": "VA",
    "compositeScore": 87.4,
    "scoreBreakdown": { "awardVelocity": 92.0, "contractValueGrowth": 88.5, "agencyDiversification": 76.0, "setasideGraduation": 93.0 },
    "totalObligated": 778301555.26,
    "awardCount": 14
  }],
  "cachedAt": "2026-03-29T00:00:00.000Z"
}
```

### `GET /api/analytics/emerging-winners`

**Filters:** `?year=`, `?min_obligated=`, `?state_code=`, `?naics_code=`, `?limit=` (max 50)

```json
{
  "year": 2010,
  "data": [{
    "cageCode": "CA12",
    "uei": "K21BNJGB9US6",
    "name": "INDYNE, INC",
    "stateCode": "VA",
    "isFirstEverAward": true,
    "firstAwardDate": "2010-01-15",
    "awardCount": 3,
    "totalObligated": 4200000.00,
    "prevYearObligated": 0,
    "growthPct": null
  }],
  "cachedAt": "2026-03-29T00:00:00.000Z"
}
```

### `GET /api/analytics/risk-profile/:cage_code`

```json
{
  "cageCode": "CA12",
  "name": "INDYNE, INC",
  "agencyConcentration": [{ "agencyCode": "5700", "agencyName": "DEPT OF THE AIR FORCE", "obligated": 620000000.00, "pctOfTotal": 79.7 }],
  "contractTypeBreakdown": [{ "type": "COST PLUS INCENTIVE FEE", "count": 8, "pct": 57.1 }],
  "modificationHealth": { "totalContracts": 14, "totalModifications": 42, "avgModificationsPerContract": 3.0, "highModContracts": 3 },
  "cachedAt": "2026-03-29T00:00:00.000Z"
}
```

### `GET /api/analytics/sector-heatmap`

**Filters:** `?year=`, `?agency_code=`, `?limit=` (max 20)

```json
{
  "year": 2010,
  "data": [{
    "naicsCode": "517110",
    "naicsName": "WIRED TELECOMMUNICATIONS CARRIERS",
    "totalObligated": 450000000.00,
    "awardCount": 1203,
    "topVendors": [{ "cageCode": "CA12", "name": "INDYNE, INC", "totalObligated": 778301555.26, "marketSharePct": 22.4 }]
  }],
  "cachedAt": "2026-03-29T00:00:00.000Z"
}
```

### `GET /api/analytics/win-rate/:cage_code`

**Filters:** `?year=`

```json
{
  "cageCode": "CA12",
  "name": "INDYNE, INC",
  "year": 2010,
  "totalAwards": 14,
  "competedAwards": 10,
  "soleSourceAwards": 4,
  "competitiveWinRatePct": 71.4,
  "avgOffersReceived": 2.8,
  "setasideHistory": [{ "fiscalYear": 2008, "type": "SBA", "label": "SMALL BUSINESS SET ASIDE - TOTAL" }],
  "graduatedFromSetaside": true,
  "cachedAt": "2026-03-29T00:00:00.000Z"
}
```

### `GET /api/analytics/geographic-clustering`

**Filters:** `?year=`, `?state_code=`, `?naics_code=`, `?limit=` (max vendors per region: 10)

```json
{
  "year": 2010,
  "data": [{
    "stateCode": "VA",
    "stateName": "VIRGINIA",
    "totalObligated": 12400000000.00,
    "awardCount": 28400,
    "pctOfNationalTotal": 14.2,
    "topVendors": [{ "cageCode": "CA12", "name": "INDYNE, INC", "totalObligated": 778301555.26, "regionalMarketSharePct": 6.3 }]
  }],
  "cachedAt": "2026-03-29T00:00:00.000Z"
}
```
