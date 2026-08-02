import pool, { connectPostgres, disconnectPostgres } from './postgres.js';

async function seed() {
  await connectPostgres();
  try {
    // Seed api_keys table
    await pool.query(`
      INSERT INTO api_keys (api_key, tier, label, is_active) VALUES
        ('free_test_key',    'free', 'Seed: free tier test key',         TRUE),
        ('pro_test_key',     'pro',  'Seed: pro tier test key',          TRUE),
        ('revoked_test_key', 'free', 'Seed: revoked key, exercises 401', FALSE)
      ON CONFLICT (api_key) DO UPDATE SET tier = EXCLUDED.tier, is_active = EXCLUDED.is_active, updated_at = NOW();
    `);

    // Seed rate_limit_policies table
    await pool.query(`
      INSERT INTO rate_limit_policies (scope, tier, route_pattern, max_requests, window_seconds) VALUES
        ('ip',     NULL,   '/*',         20,  60),  -- universal anonymous/IP floor
        ('ip',     NULL,   '/admin/*',    5,  60),  -- stricter IP floor on a sensitive route
        ('client', 'free', '/api/v1/*',  60,  60),
        ('client', 'pro',  '/api/v1/*', 600,  60),
        ('client', 'free', '/admin/*',   10,  60),
        ('client', 'pro',  '/admin/*',   30,  60)
      ON CONFLICT (scope, COALESCE(tier, ''), route_pattern) DO UPDATE SET
        max_requests = EXCLUDED.max_requests, window_seconds = EXCLUDED.window_seconds, updated_at = NOW();
    `);

    console.log('Seed data inserted successfully.');
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await disconnectPostgres();
  }
}

seed();
