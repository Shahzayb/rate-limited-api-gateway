
CREATE TABLE rate_limit_policies (
  id SERIAL PRIMARY KEY,
  scope VARCHAR(10) NOT NULL,
  tier VARCHAR(50),
  route_pattern VARCHAR(255) NOT NULL,
  max_requests INT NOT NULL,
  window_seconds INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rate_limit_policies_scope_check CHECK (scope IN ('ip', 'client')),
  CONSTRAINT rate_limit_policies_scope_tier_check CHECK (
    (scope = 'ip' AND tier IS NULL) OR
    (scope = 'client' AND tier IS NOT NULL AND btrim(tier) <> '')
  ),
  CONSTRAINT rate_limit_policies_max_requests_check CHECK (max_requests >= 0),
  CONSTRAINT rate_limit_policies_window_seconds_check CHECK (window_seconds > 0)
);
CREATE UNIQUE INDEX rate_limit_policies_identity_idx
  ON rate_limit_policies (scope, COALESCE(tier, ''), route_pattern);
CREATE INDEX rate_limit_policies_active_idx ON rate_limit_policies (is_active);
