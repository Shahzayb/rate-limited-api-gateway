import pool, { connectPostgres, disconnectPostgres } from './postgres.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  await connectPostgres();
  try {
    // Ensure schema_migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[0] ?? '0', 10);
        const numB = parseInt(b.split('_')[0] ?? '0', 10);
        return numA - numB;
      });

    const { rows: appliedMigrations } = await pool.query('SELECT filename FROM schema_migrations');
    const appliedMigrationNames = new Set(appliedMigrations.map((row) => row.filename));

    for (const file of migrationFiles) {
      if (!appliedMigrationNames.has(file)) {
        const filePath = path.join(migrationsDir, file as string);
        const sql = await fs.readFile(filePath, 'utf-8');

        await pool.query('BEGIN');
        try {
          await pool.query(sql);
          await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
          await pool.query('COMMIT');
          console.log(`Migration ${file} executed successfully.`);
        } catch (error) {
          await pool.query('ROLLBACK');
          console.error(`Error running migration ${file}:`, error);
          process.exit(1);
        }
      } else {
        console.log(`Migration ${file} already applied, skipping.`);
      }
    }

    console.log('All migrations processed.');
  } catch (error) {
    console.error('Error during migration process:', error);
    process.exit(1);
  } finally {
    await disconnectPostgres();
  }
}

runMigrations();
