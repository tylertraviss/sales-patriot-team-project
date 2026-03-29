const { drizzle } = require('drizzle-orm/node-postgres');
const { pool } = require('../connection');
const schema = require('./schema');

const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV !== 'production',
});

module.exports = {
  db,
  schema,
};
