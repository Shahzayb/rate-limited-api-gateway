import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function connectPostgres() {
  try {
    await pool.connect();
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error('Error connecting to PostgreSQL', err);
    process.exit(1);
  }
}

export async function disconnectPostgres() {
  await pool.end();
  console.log('Disconnected from PostgreSQL');
}

export default pool;
