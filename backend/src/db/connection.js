const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'dla_awards',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max:      parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

/**
 * Runs a parameterised query and returns the result rows.
 * @param {string} text - SQL query string
 * @param {any[]} params - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.debug('query', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Acquires a client from the pool for transaction use.
 * Caller is responsible for calling client.release().
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
