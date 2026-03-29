-- DLA Awards Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table: keyed by CAGE code
CREATE TABLE IF NOT EXISTS companies (
  cage_code     VARCHAR(10)  PRIMARY KEY,
  company_name  VARCHAR(500) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies USING gin(to_tsvector('english', company_name));

-- Awards table: core DLA award data
CREATE TABLE IF NOT EXISTS awards (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  cage_code       VARCHAR(10)  NOT NULL REFERENCES companies(cage_code) ON DELETE CASCADE,
  award_amount    NUMERIC(18, 2),
  award_date      DATE,
  contract_number VARCHAR(100),
  description     TEXT,
  dla_office      VARCHAR(200),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_awards_cage_code   ON awards(cage_code);
CREATE INDEX IF NOT EXISTS idx_awards_award_date  ON awards(award_date DESC);
CREATE INDEX IF NOT EXISTS idx_awards_dla_office  ON awards(dla_office);
CREATE INDEX IF NOT EXISTS idx_awards_amount      ON awards(award_amount DESC);
