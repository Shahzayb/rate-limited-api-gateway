import pool, { connectPostgres, disconnectPostgres } from './postgres.js';

async function seedData() {
  await connectPostgres();
  try {
    const seedSql = `
      INSERT INTO rate_limit_config (api_key, path, max_requests, window_seconds) VALUES
      ('test_key', '/api/v1', 10, 60),
      ('test_key', '/admin', 2, 30)
      ON CONFLICT (api_key, path) DO UPDATE SET
      max_requests = EXCLUDED.max_requests,
      window_seconds = EXCLUDED.window_seconds,
      updated_at = NOW();
    `;
    await pool.query(seedSql);
    console.log('Seed data inserted successfully.');
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await disconnectPostgres();
  }
}

seedData();
