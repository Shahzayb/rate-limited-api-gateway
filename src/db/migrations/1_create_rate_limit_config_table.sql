CREATE TABLE rate_limit_config (
  api_key VARCHAR(255) NOT NULL,
  path VARCHAR(255) NOT NULL,
  max_requests INT NOT NULL,
  window_seconds INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (api_key, path)
);