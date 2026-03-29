require('dotenv').config();

const db = require('../connection');
const { refreshAnalyticsCaches, MATERIALIZED_VIEWS } = require('../analyticsCache');

async function main() {
  const client = await db.getClient();

  try {
    const startedAt = Date.now();
    await refreshAnalyticsCaches(client);

    const counts = {};
    for (const viewName of MATERIALIZED_VIEWS) {
      const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${viewName}`);
      counts[viewName] = Number(result.rows[0].count || 0);
    }

    console.log(JSON.stringify({
      ok: true,
      durationMs: Date.now() - startedAt,
      counts,
    }, null, 2));
  } finally {
    client.release();
    await db.pool.end();
  }
}

main().catch(async (error) => {
  console.error(error);
  await db.pool.end().catch(() => {});
  process.exit(1);
});
