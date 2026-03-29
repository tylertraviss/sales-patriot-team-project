const { Pool } = require('pg');
const logger = require('../logger');

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

pool.on('connect', () => logger.debug('pg pool: new client connected'));
pool.on('remove',  () => logger.debug('pg pool: client removed'));
pool.on('error',   (err) => logger.error('pg pool: unexpected error', { stack: err.stack }));

/**
 * Runs a parameterised query and returns the result rows.
 * @param {string} text - SQL query string
 * @param {any[]} params - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('db query', { duration_ms: duration, rows: res.rowCount, query: text.replace(/\s+/g, ' ').trim() });
  if (duration > 2000) {
    logger.warn('slow query detected', { duration_ms: duration, query: text.replace(/\s+/g, ' ').trim() });
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
