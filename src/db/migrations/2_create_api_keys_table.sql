
CREATE TABLE api_keys (
  api_key VARCHAR(255) PRIMARY KEY,
  tier VARCHAR(50) NOT NULL,
  label VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT api_keys_tier_not_blank CHECK (btrim(tier) <> '')
);
CREATE INDEX api_keys_tier_idx ON api_keys (tier);
