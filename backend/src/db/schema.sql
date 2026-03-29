-- DLA Awards Database Schema
--
-- Design goals:
-- 1. Make the ingest + analytics model the only source of truth.
-- 2. Support the real 660-column CSV exports from local disk or API upload.
-- 3. Make "which CAGE code should I invest in?" queries cheap by pre-shaping
--    vendor- and year-level materialized views over the fact data.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ingest layer
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ingest_files (
  ingest_file_id   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name        TEXT        NOT NULL UNIQUE,
  file_path        TEXT,
  period_start     DATE,
  period_end       DATE,
  file_size_bytes  BIGINT,
  row_count        BIGINT,
  header_hash      TEXT,
  load_status      TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (load_status IN ('pending', 'loaded', 'failed', 'archived')),
  loaded_at        TIMESTAMPTZ,
  metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_files_period
  ON ingest_files (period_start, period_end);

CREATE TABLE IF NOT EXISTS raw_award_rows (
  raw_award_row_id  BIGSERIAL   PRIMARY KEY,
  ingest_file_id    UUID        NOT NULL REFERENCES ingest_files(ingest_file_id) ON DELETE CASCADE,
  source_row_number BIGINT      NOT NULL,
  source_row_hash   TEXT,
  contract_id       TEXT,
  acquisition_id    TEXT,
  vendor_uei        TEXT,
  vendor_name       TEXT,
  award_date        DATE,
  reveal_date       DATE,
  payload           JSONB       NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ingest_file_id, source_row_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_award_rows_hash
  ON raw_award_rows (source_row_hash)
  WHERE source_row_hash IS NOT NULL AND BTRIM(source_row_hash) <> '';

CREATE INDEX IF NOT EXISTS idx_raw_award_rows_contract_id
  ON raw_award_rows (contract_id)
  WHERE contract_id IS NOT NULL AND BTRIM(contract_id) <> '';

CREATE INDEX IF NOT EXISTS idx_raw_award_rows_award_date
  ON raw_award_rows (award_date DESC);

CREATE INDEX IF NOT EXISTS idx_raw_award_rows_payload
  ON raw_award_rows USING GIN (payload jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Core analytics layer
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendor_entities (
  vendor_id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_key                   TEXT         NOT NULL UNIQUE,
  cage_code                    VARCHAR(10),
  uei                          VARCHAR(20),
  vendor_name                  VARCHAR(500) NOT NULL,
  business_type_description    TEXT,
  socio_economic_indicator     TEXT,
  parent_company_name          VARCHAR(500),
  parent_uei                   VARCHAR(20),
  ultimate_uei                 VARCHAR(20),
  ultimate_uei_name            VARCHAR(500),
  vendor_phone_number          TEXT,
  vendor_fax_number            TEXT,
  annual_revenue               NUMERIC(18, 2),
  number_of_employees          INTEGER,
  vendor_registration_date     DATE,
  vendor_renewal_date          DATE,
  city                         VARCHAR(200),
  state_code                   VARCHAR(10),
  state_name                   VARCHAR(100),
  zip_code                     VARCHAR(20),
  country_code                 VARCHAR(10),
  country_name                 VARCHAR(100),
  source_vendor_info_id        TEXT,
  source_vendor_history_id     TEXT,
  raw_vendor                   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_entities_cage_code
  ON vendor_entities (cage_code)
  WHERE cage_code IS NOT NULL AND BTRIM(cage_code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_entities_uei
  ON vendor_entities (uei)
  WHERE uei IS NOT NULL AND BTRIM(uei) <> '';

CREATE INDEX IF NOT EXISTS idx_vendor_entities_name_trgm
  ON vendor_entities USING GIN (vendor_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendor_entities_name_tsv
  ON vendor_entities USING GIN (to_tsvector('english', vendor_name));

DROP TRIGGER IF EXISTS trg_vendor_entities_set_updated_at ON vendor_entities;
CREATE TRIGGER trg_vendor_entities_set_updated_at
BEFORE UPDATE ON vendor_entities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS naics_codes (
  code         VARCHAR(10) PRIMARY KEY,
  description  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_naics_codes_set_updated_at ON naics_codes;
CREATE TRIGGER trg_naics_codes_set_updated_at
BEFORE UPDATE ON naics_codes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS product_service_codes (
  code         VARCHAR(10) PRIMARY KEY,
  description  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_product_service_codes_set_updated_at ON product_service_codes;
CREATE TRIGGER trg_product_service_codes_set_updated_at
BEFORE UPDATE ON product_service_codes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS award_transactions (
  award_tx_id                          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  award_key                            TEXT         NOT NULL UNIQUE,
  ingest_file_id                       UUID         REFERENCES ingest_files(ingest_file_id) ON DELETE SET NULL,
  raw_award_row_id                     BIGINT       REFERENCES raw_award_rows(raw_award_row_id) ON DELETE SET NULL,
  vendor_id                            UUID         NOT NULL REFERENCES vendor_entities(vendor_id) ON DELETE RESTRICT,
  contract_id                          TEXT,
  acquisition_id                       TEXT,
  source_vendor_info_id                TEXT,
  source_vendor_history_id             TEXT,
  piid                                 TEXT,
  reference_piid                       TEXT,
  contract_number                      TEXT,
  modification_number                  TEXT,
  reference_modification_number        TEXT,
  transaction_number                   TEXT,
  award_or_idv                         TEXT,
  award_type                           TEXT,
  award_type_description               TEXT,
  award_status                         TEXT,
  total_actions                        INTEGER,
  number_of_actions                    INTEGER,
  award_amount                         NUMERIC(18, 2),
  total_contract_value                 NUMERIC(18, 2),
  base_and_exercised_options_value     NUMERIC(18, 2),
  award_date                           DATE,
  date_signed                          DATE,
  reveal_date                          DATE,
  solicitation_date                    DATE,
  period_of_performance_start_date     DATE,
  current_completion_date              DATE,
  award_ultimate_completion_date       DATE,
  award_fiscal_year                    INTEGER,
  contract_fiscal_year                 INTEGER,
  naics_code                           VARCHAR(10) REFERENCES naics_codes(code) ON DELETE SET NULL,
  naics_description                    TEXT,
  product_service_code                 VARCHAR(10) REFERENCES product_service_codes(code) ON DELETE SET NULL,
  product_service_description          TEXT,
  product_or_service_type              TEXT,
  description_of_requirement           TEXT,
  business_type_description            TEXT,
  socio_economic_indicator             TEXT,
  extent_competed_code                 TEXT,
  extent_competed_name                 TEXT,
  set_aside_code                       TEXT,
  set_aside_name                       TEXT,
  contracting_department_code          TEXT,
  contracting_department_name          TEXT,
  contracting_agency_code              TEXT,
  contracting_agency_name              TEXT,
  contracting_office_code              TEXT,
  contracting_office_name              TEXT,
  funding_department_code              TEXT,
  funding_department_name              TEXT,
  funding_agency_code                  TEXT,
  funding_agency_name                  TEXT,
  funding_office_code                  TEXT,
  funding_office_name                  TEXT,
  place_of_performance_city            TEXT,
  place_of_performance_state_code      TEXT,
  place_of_performance_state_name      TEXT,
  place_of_performance_country_code    TEXT,
  place_of_performance_country_name    TEXT,
  place_of_performance_zip             TEXT,
  extra_attributes                     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_award_transactions_vendor_date
  ON award_transactions (vendor_id, award_date DESC);

CREATE INDEX IF NOT EXISTS idx_award_transactions_award_date
  ON award_transactions (award_date DESC);

CREATE INDEX IF NOT EXISTS idx_award_transactions_date_signed
  ON award_transactions (date_signed DESC);

CREATE INDEX IF NOT EXISTS idx_award_transactions_contract
  ON award_transactions (contract_id)
  WHERE contract_id IS NOT NULL AND BTRIM(contract_id) <> '';

CREATE INDEX IF NOT EXISTS idx_award_transactions_piid
  ON award_transactions (piid)
  WHERE piid IS NOT NULL AND BTRIM(piid) <> '';

CREATE INDEX IF NOT EXISTS idx_award_transactions_cagency
  ON award_transactions (contracting_agency_code, award_date DESC)
  WHERE contracting_agency_code IS NOT NULL AND BTRIM(contracting_agency_code) <> '';

CREATE INDEX IF NOT EXISTS idx_award_transactions_naics
  ON award_transactions (naics_code, award_date DESC)
  WHERE naics_code IS NOT NULL AND BTRIM(naics_code) <> '';

CREATE INDEX IF NOT EXISTS idx_award_transactions_amount
  ON award_transactions (award_amount DESC);

CREATE INDEX IF NOT EXISTS idx_award_transactions_extra_attributes
  ON award_transactions USING GIN (extra_attributes jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Analytics cache
-- ---------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS cage_code_investment_summary;
DROP MATERIALIZED VIEW IF EXISTS vendor_investment_summary;
DROP MATERIALIZED VIEW IF EXISTS vendor_year_metrics;

DROP VIEW IF EXISTS cage_code_investment_summary;
DROP VIEW IF EXISTS vendor_investment_summary;
DROP VIEW IF EXISTS vendor_year_metrics;

CREATE MATERIALIZED VIEW vendor_year_metrics AS
WITH base AS (
  SELECT
    a.*,
    COALESCE(
      a.award_fiscal_year,
      a.contract_fiscal_year,
      EXTRACT(YEAR FROM COALESCE(a.award_date, a.date_signed, a.reveal_date))::INT
    ) AS fiscal_year
  FROM award_transactions a
)
SELECT
  v.vendor_id,
  v.vendor_key,
  v.cage_code,
  v.uei,
  v.vendor_name AS company_name,
  b.fiscal_year,
  MAX(NOW()) AS cached_at,
  COUNT(*) AS award_count,
  COUNT(DISTINCT COALESCE(NULLIF(b.contract_id, ''), NULLIF(b.piid, ''), b.award_key)) AS contract_count,
  SUM(COALESCE(b.award_amount, 0)) AS obligated_amount,
  SUM(COALESCE(b.total_contract_value, 0)) AS total_contract_value,
  COUNT(DISTINCT NULLIF(b.contracting_agency_code, '')) AS distinct_contracting_agencies,
  COUNT(DISTINCT NULLIF(b.naics_code, '')) AS distinct_naics_codes
FROM base b
JOIN vendor_entities v ON v.vendor_id = b.vendor_id
WHERE b.fiscal_year IS NOT NULL
GROUP BY
  v.vendor_id,
  v.vendor_key,
  v.cage_code,
  v.uei,
  v.vendor_name,
  b.fiscal_year;

CREATE UNIQUE INDEX idx_vendor_year_metrics_vendor_year
  ON vendor_year_metrics (vendor_id, fiscal_year);

CREATE INDEX idx_vendor_year_metrics_cage_code
  ON vendor_year_metrics (cage_code, fiscal_year DESC);

CREATE MATERIALIZED VIEW vendor_investment_summary AS
WITH yearly AS (
  SELECT * FROM vendor_year_metrics
),
latest_year AS (
  SELECT
    y.*,
    LAG(y.obligated_amount) OVER (PARTITION BY y.vendor_id ORDER BY y.fiscal_year) AS previous_year_obligated_amount,
    ROW_NUMBER() OVER (PARTITION BY y.vendor_id ORDER BY y.fiscal_year DESC) AS rn
  FROM yearly y
),
lifetime AS (
  SELECT
    a.vendor_id,
    COUNT(*) AS award_count,
    COUNT(DISTINCT COALESCE(NULLIF(a.contract_id, ''), NULLIF(a.piid, ''), a.award_key)) AS contract_count,
    SUM(COALESCE(a.award_amount, 0)) AS total_obligated_amount,
    SUM(COALESCE(a.total_contract_value, 0)) AS total_contract_value,
    AVG(NULLIF(a.award_amount, 0)) AS avg_award_amount,
    MIN(COALESCE(a.award_date, a.date_signed, a.reveal_date)) AS first_award_date,
    MAX(COALESCE(a.award_date, a.date_signed, a.reveal_date)) AS last_award_date,
    COUNT(DISTINCT NULLIF(a.contracting_agency_code, '')) AS distinct_contracting_agencies,
    COUNT(DISTINCT NULLIF(a.naics_code, '')) AS distinct_naics_codes,
    COUNT(DISTINCT NULLIF(a.place_of_performance_state_code, '')) AS distinct_performance_states
  FROM award_transactions a
  GROUP BY a.vendor_id
)
SELECT
  v.vendor_id,
  v.vendor_key,
  v.cage_code,
  v.uei,
  v.vendor_name AS company_name,
  ly.cached_at,
  l.first_award_date,
  l.last_award_date,
  l.award_count,
  l.contract_count,
  l.total_obligated_amount,
  l.total_contract_value,
  ROUND(COALESCE(l.avg_award_amount, 0), 2) AS avg_award_amount,
  l.distinct_contracting_agencies,
  l.distinct_naics_codes,
  l.distinct_performance_states,
  ly.fiscal_year AS latest_fiscal_year,
  ly.obligated_amount AS latest_year_obligated_amount,
  ly.previous_year_obligated_amount,
  CASE
    WHEN ly.previous_year_obligated_amount IS NULL OR ly.previous_year_obligated_amount = 0 THEN NULL
    ELSE ROUND(((ly.obligated_amount - ly.previous_year_obligated_amount) / ly.previous_year_obligated_amount) * 100, 2)
  END AS yoy_growth_pct
FROM vendor_entities v
JOIN lifetime l ON l.vendor_id = v.vendor_id
LEFT JOIN latest_year ly
  ON ly.vendor_id = v.vendor_id
 AND ly.rn = 1;

CREATE UNIQUE INDEX idx_vendor_investment_summary_vendor
  ON vendor_investment_summary (vendor_id);

CREATE INDEX idx_vendor_investment_summary_cage
  ON vendor_investment_summary (cage_code);

CREATE MATERIALIZED VIEW cage_code_investment_summary AS
SELECT *
FROM vendor_investment_summary
WHERE cage_code IS NOT NULL AND BTRIM(cage_code) <> '';

CREATE UNIQUE INDEX idx_cage_code_investment_summary_cage
  ON cage_code_investment_summary (cage_code);
