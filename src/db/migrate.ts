import pool, { connectPostgres, disconnectPostgres } from './postgres.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  await connectPostgres();
  try {
    const migrationPath = path.join(
      __dirname,
      'migrations',
      '1_create_rate_limit_config_table.sql'
    );
    const sql = await fs.readFile(migrationPath, 'utf-8');
    await pool.query(sql);
    console.log('Migration 1_create_rate_limit_config_table.sql executed successfully.');
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  } finally {
    await disconnectPostgres();
  }
}

runMigrations();
