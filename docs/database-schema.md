# Database Schema

## Why the schema changed

The original backend schema was only enough for a demo upload:

- `companies(cage_code, company_name)`
- `awards(cage_code, award_amount, award_date, ...)`

That does not fit the real dataset.

The USB mounted on this Mac contains 71 award CSV files under `/Volumes/USB`, and the sampled file structure is stable across the set:

- `660` columns per CSV
- about `41.8 GB` across the mounted files
- sample file `data/awards_20100314_20100314.csv` has `4,201` rows

The dataset is also much wider than a normal CRUD schema:

- vendor identity and hierarchy
- award transaction facts
- funding and contracting organization fields
- NAICS / PSC / set-aside / competition metadata
- place-of-performance fields
- many sparse code/name pairs

One important finding from the sample data: `vendorData.cage_code` is sparse, while `uei` is consistently populated. That means CAGE code should be treated as an important attribute, but not the only vendor key.

## Schema layers

### 1. Ingest layer

Tables:

- `ingest_files`
- `raw_award_rows`

Purpose:

- track which CSV file was loaded
- keep the original row payload for reprocessing
- support idempotent reloads and overlap detection across export windows

This layer is the safety net. Do not skip it for the full USB import.

### 2. Core analytics layer

Tables:

- `vendor_entities`
- `naics_codes`
- `product_service_codes`
- `award_transactions`

Purpose:

- `vendor_entities` is the canonical vendor dimension
- `award_transactions` is the fact table, one row per award transaction/action
- long-tail fields stay in `award_transactions.extra_attributes` instead of exploding the schema into hundreds of nullable columns

Recommended vendor identity priority for loaders:

1. `CAGE:<cage_code>`
2. `UEI:<uei>`
3. `NAME:<normalized vendor name>:<country_code>:<state_code>`

That should become the `vendor_key` used to upsert `vendor_entities`.

Recommended award identity priority for loaders:

1. `contractId`
2. `acquisitionId`
3. a fallback composite key such as `piid + modification_number + transaction_number + vendor_key + award_date`

That should become `award_transactions.award_key`.

### 3. Read model

Views:

- `vendor_year_metrics`
- `vendor_investment_summary`
- `cage_code_investment_summary`

Purpose:

- keep investor-facing queries fast and opinionated
- expose ranking and trend fields without asking the frontend to aggregate raw awards
- provide a data layer for the REST and analytics routes documented in [API.md](/Users/antoniocoppe/code/sales-patriot-team-project/API.md)

## Investment-oriented views

Views:

- `vendor_year_metrics`
- `vendor_investment_summary`
- `cage_code_investment_summary`

These exist specifically for the project question: "what CAGE code should I invest in?"

They aggregate vendor performance into fields the backend can rank on:

- total obligated dollars
- total contract value
- award count
- contract count
- latest fiscal year activity
- year-over-year obligated-dollar growth
- agency diversification
- NAICS diversification
- geographic diversification

`cage_code_investment_summary` filters the vendor summary down to rows where a CAGE code is present. If the team later decides CAGE coverage is too sparse, query `vendor_investment_summary` instead and display CAGE as a nullable attribute.

## Recommended ingest workflow

For the full USB dataset, use the disk importer rather than row-by-row browser uploads. The project now supports both API upload for smaller files and direct CSV import for local/USB datasets.

Recommended flow:

1. Register the file in `ingest_files`.
2. Stream the CSV into `raw_award_rows` in batches.
3. Upsert `vendor_entities` from the raw payload.
4. Upsert `naics_codes` and `product_service_codes`.
5. Upsert `award_transactions`.
6. Query `vendor_investment_summary` or `cage_code_investment_summary` for company rankings.

Why:

- several files are over `1 GB`
- overlapping export windows appear on the USB
- row-by-row HTTP uploads will be too slow and too hard to deduplicate reliably

Available import commands from `backend/`:

- `npm run db:init`
- `npm run db:import -- ../data`
- `npm run db:import -- /Volumes/USB`

## What this means for the team

- [API.md](/Users/antoniocoppe/code/sales-patriot-team-project/API.md) is the route contract source of truth.
- Backend can query `vendor_investment_summary` or `cage_code_investment_summary` for rankings and investor-facing analytics.
- The schema is designed to support the vendor, award, agency, NAICS, and analytics route families without carrying a separate demo storage model.

## Drizzle setup

Drizzle is now configured in the backend:

- config: [backend/drizzle.config.mjs](/Users/antoniocoppe/code/sales-patriot-team-project/backend/drizzle.config.mjs)
- runtime client: [backend/src/db/drizzle/client.js](/Users/antoniocoppe/code/sales-patriot-team-project/backend/src/db/drizzle/client.js)
- schema mirror: [backend/src/db/drizzle/schema.js](/Users/antoniocoppe/code/sales-patriot-team-project/backend/src/db/drizzle/schema.js)

Available commands from `backend/`:

- `npm run db:studio`
- `npm run db:pull`

Important constraint:

- [backend/src/db/schema.sql](/Users/antoniocoppe/code/sales-patriot-team-project/backend/src/db/schema.sql) remains the DDL source of truth right now.
- [API.md](/Users/antoniocoppe/code/sales-patriot-team-project/API.md) remains the API contract source of truth.
- The Drizzle schema mirrors the main tables for query-builder use and Studio access.
- We are not using Drizzle-generated migrations as the canonical setup path yet, because the database also includes hand-authored SQL objects such as triggers and analytics views.
