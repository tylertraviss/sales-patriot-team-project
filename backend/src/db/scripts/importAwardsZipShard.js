const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const db = require('../connection');
const { refreshAnalyticsCaches } = require('../analyticsCache');
const logger = require('../../logger');
const { DEFAULT_BATCH_SIZE, importCsvFile } = require('./importAwardsCsv');

function usage() {
  console.error('Usage: node src/db/scripts/importAwardsZipShard.js <zip-file>');
  process.exit(1);
}

function getIntEnv(name, fallback = null) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name} value "${rawValue}"`);
  }

  return parsed;
}

function getBoolEnv(name, fallback = false) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'y', 'on'].includes(String(rawValue).trim().toLowerCase());
}

function listZipCsvEntries(zipPath) {
  const result = spawnSync('unzip', ['-Z1', zipPath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `Failed to list zip entries for ${zipPath}`);
  }

  return result.stdout
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry && entry.toLowerCase().endsWith('.csv') && !entry.startsWith('__MACOSX/'))
    .sort((left, right) => left.localeCompare(right));
}

function extractZipEntry(zipPath, zipEntry, targetPath) {
  return new Promise((resolve, reject) => {
    const unzip = spawn('unzip', ['-p', zipPath, zipEntry], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const output = fs.createWriteStream(targetPath);
    let stderr = '';
    let settled = false;

    unzip.stdout.pipe(output);
    unzip.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;

      output.close(() => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    };

    unzip.on('error', (error) => finish(error));
    output.on('error', (error) => finish(error));

    unzip.on('close', (code) => {
      if (code !== 0) {
        finish(new Error(stderr.trim() || `Failed to extract ${zipEntry}`));
        return;
      }

      finish();
    });
  });
}

async function getLoadedFileNames() {
  const result = await db.query(
    `SELECT file_name
       FROM ingest_files
      WHERE load_status = 'loaded'`,
  );

  return new Set(result.rows.map((row) => row.file_name));
}

function selectShardEntries(entries, shardCount, shardIndex) {
  if (shardCount <= 1) {
    return entries;
  }

  return entries.filter((_, index) => index % shardCount === shardIndex);
}

async function main() {
  const zipArg = process.argv[2];
  if (!zipArg) {
    usage();
  }

  const zipPath = path.resolve(process.cwd(), zipArg);
  const zipStat = await fs.promises.stat(zipPath);
  if (!zipStat.isFile()) {
    throw new Error(`${zipPath} is not a file`);
  }

  const shardCount = getIntEnv('IMPORT_SHARD_COUNT', 1);
  const shardIndex = getIntEnv('IMPORT_SHARD_INDEX', 0);
  if (shardCount < 1) {
    throw new Error(`IMPORT_SHARD_COUNT must be >= 1; got ${shardCount}`);
  }
  if (shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error(`IMPORT_SHARD_INDEX must be between 0 and ${shardCount - 1}; got ${shardIndex}`);
  }

  const tempDir = path.resolve(
    process.env.IMPORT_TEMP_DIR || path.join(path.dirname(zipPath), `.import-tmp-shard-${shardIndex}`),
  );
  const maxFiles = getIntEnv('IMPORT_MAX_FILES');
  const batchSize = Number.parseInt(process.env.IMPORT_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10);
  const refreshOnComplete = getBoolEnv('IMPORT_REFRESH_ON_COMPLETE', false);

  await fs.promises.mkdir(tempDir, { recursive: true });

  const zipEntries = listZipCsvEntries(zipPath);
  const loadedFileNames = await getLoadedFileNames();
  const pendingEntries = zipEntries.filter((entry) => !loadedFileNames.has(path.basename(entry)));
  const shardedEntries = selectShardEntries(pendingEntries, shardCount, shardIndex);
  const selectedEntries = maxFiles === null ? shardedEntries : shardedEntries.slice(0, maxFiles);

  logger.info('zip shard import started', {
    zipPath,
    zipEntries: zipEntries.length,
    pendingEntries: pendingEntries.length,
    shardCount,
    shardIndex,
    selectedEntries: selectedEntries.length,
    batchSize,
    tempDir,
    refreshOnComplete,
  });

  const aggregate = {
    shardIndex,
    shardCount,
    filesSeen: zipEntries.length,
    filesSkippedLoaded: zipEntries.length - pendingEntries.length,
    filesAssigned: shardedEntries.length,
    filesImported: 0,
    totalRows: 0,
    insertedRows: 0,
    skippedRows: 0,
    rawRowsLinked: 0,
  };

  for (const entry of selectedEntries) {
    const fileName = path.basename(entry);
    const tempPath = path.join(tempDir, fileName);

    logger.info('extracting zip shard entry', { entry, shardIndex, tempPath });
    await extractZipEntry(zipPath, entry, tempPath);

    try {
      logger.info('importing extracted shard csv', { entry, fileName, shardIndex });
      const result = await importCsvFile(tempPath, batchSize);
      aggregate.filesImported++;
      aggregate.totalRows += result.total;
      aggregate.insertedRows += result.inserted;
      aggregate.skippedRows += result.skipped;
      aggregate.rawRowsLinked += result.rawRowsLinked;

      console.log(
        JSON.stringify(
          {
            shardIndex,
            entry,
            ingestFileId: result.ingestFileId,
            total: result.total,
            inserted: result.inserted,
            skipped: result.skipped,
            rawRowsLinked: result.rawRowsLinked,
            sampleErrors: result.errors.slice(0, 5),
          },
          null,
          2,
        ),
      );
    } finally {
      await fs.promises.rm(tempPath, { force: true });
    }
  }

  if (refreshOnComplete) {
    const client = await db.getClient();
    try {
      await refreshAnalyticsCaches(client);
    } finally {
      client.release();
    }
  }

  console.log(JSON.stringify(aggregate, null, 2));
}

main()
  .catch((error) => {
    logger.error('zip shard import failed', { error: error.message, stack: error.stack });
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
