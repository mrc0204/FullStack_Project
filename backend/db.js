import pg from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

dns.setDefaultResultOrder('ipv6first');
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

// Initialize postgres pool
const pool = new Pool({
  connectionString,
  // Configure SSL connections for cloud-hosted Postgres instances like Supabase
  ssl: connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')
    ? { rejectUnauthorized: false }
    : false
});

pool.on('connect', () => {
  console.log('Successfully connected to the PostgreSQL database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Helper to convert SQLite "?" placeholders to PostgreSQL "$1, $2..." placeholders
const convertSql = (sql) => {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
};

// Promise wrappers adapting SQLite style calls to pg
export const dbRun = async (sql, params = []) => {
  let finalSql = sql;
  
  // Auto-append RETURNING id for inserts so that result.lastID is supported natively
  const trimmed = finalSql.trim().toUpperCase();
  if (trimmed.startsWith('INSERT INTO')) {
    if (!trimmed.includes('RETURNING')) {
      finalSql += ' RETURNING id';
    }
  }

  const pgSql = convertSql(finalSql);
  const res = await pool.query(pgSql, params);
  
  const lastID = res.rows[0]?.id || null;
  return { lastID, changes: res.rowCount };
};

export const dbGet = async (sql, params = []) => {
  const pgSql = convertSql(sql);
  const res = await pool.query(pgSql, params);
  return res.rows[0] || null;
};

export const dbAll = async (sql, params = []) => {
  const pgSql = convertSql(sql);
  const res = await pool.query(pgSql, params);
  return res.rows || [];
};

// Initialize Supabase PostgreSQL schema
export const initDb = async () => {
  // If no connection string is set, don't run schema initialization to prevent crash
  if (!connectionString) {
    console.warn('DATABASE_URL is not set. Skipping schema initialization.');
    return;
  }

  try {
    // 1. Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) CHECK(role IN ('client', 'freelancer')) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Profiles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skills TEXT, -- JSON Array formatted string
        experience TEXT,
        portfolio TEXT, -- JSON Array formatted string
        rates REAL,
        availability VARCHAR(50) CHECK(availability IN ('full-time', 'part-time', 'unavailable')) DEFAULT 'full-time',
        preferred_project_types TEXT,
        bio TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Projects
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        scope TEXT,
        required_skills TEXT, -- JSON Array formatted string
        budget REAL,
        deadline VARCHAR(255),
        status VARCHAR(50) CHECK(status IN ('open', 'in_progress', 'completed', 'archived', 'closed')) DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Milestones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS milestones (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        budget REAL,
        deadline VARCHAR(255),
        status VARCHAR(50) CHECK(status IN ('pending', 'submitted', 'approved', 'revision_requested', 'paid')) DEFAULT 'pending',
        submission_notes TEXT,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Proposals
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proposals (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cover_letter TEXT,
        bid_amount REAL,
        estimated_duration VARCHAR(255),
        status VARCHAR(50) CHECK(status IN ('pending', 'shortlisted', 'accepted', 'rejected')) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Matches
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        freelancer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_score INTEGER,
        match_explanation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_project_freelancer UNIQUE (project_id, freelancer_id)
      );
    `);

    // 7. Messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_text TEXT NOT NULL,
        is_ai_draft INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Reviews
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reviewee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('PostgreSQL database tables initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL schema:', err);
    throw err;
  }
};

export default pool;
