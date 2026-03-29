const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../connection');
const { refreshAnalyticsCaches } = require('../analyticsCache');
const logger = require('../../logger');
const {
  beginIngestFile,
  createIngestState,
  finalizeIngestFile,
  ingestAwardRows,
  markIngestFile,
} = require('../importers/awardsIngest');

const DEFAULT_BATCH_SIZE = Number.parseInt(process.env.IMPORT_BATCH_SIZE || '1000', 10);

function usage() {
  console.error('Usage: node src/db/scripts/importAwardsCsv.js <csv-file-or-directory>');
  process.exit(1);
}

async function listCsvFiles(targetPath) {
  const stat = await fs.promises.stat(targetPath);
  if (stat.isFile()) {
    return targetPath.toLowerCase().endsWith('.csv') ? [targetPath] : [];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      return listCsvFiles(absolutePath);
    }

    return absolutePath.toLowerCase().endsWith('.csv') ? [absolutePath] : [];
  }));

  return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function runBatch(ingestFileId, rows, startRowNumber, state) {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    await ingestAwardRows(client, state, {
      ingestFileId,
      rows,
      startRowNumber,
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function withClient(run) {
  const client = await db.getClient();

  try {
    return await run(client);
  } finally {
    client.release();
  }
}

async function markImportFailed({ ingestFileId, fileName, filePath, fileSizeBytes, rowCount, errorMessage }) {
  if (ingestFileId) {
    await withClient(async (client) => {
      await markIngestFile(client, ingestFileId, rowCount, 'failed', {
        source: 'disk_import',
        error: errorMessage,
      });
    });
    return;
  }

  await db.query(
    `INSERT INTO ingest_files (
       ingest_file_id,
       file_name,
       file_path,
       file_size_bytes,
       row_count,
       load_status,
       metadata
     )
     VALUES (
       COALESCE($1, uuid_generate_v4()),
       $2,
       $3,
       $4,
       $5,
       'failed',
       $6::jsonb
     )
     ON CONFLICT (file_name) DO UPDATE
       SET file_path = COALESCE(EXCLUDED.file_path, ingest_files.file_path),
           file_size_bytes = COALESCE(EXCLUDED.file_size_bytes, ingest_files.file_size_bytes),
           row_count = COALESCE(EXCLUDED.row_count, ingest_files.row_count),
           load_status = 'failed',
           loaded_at = NULL,
           metadata = ingest_files.metadata || EXCLUDED.metadata`,
    [
      ingestFileId,
      fileName,
      filePath,
      fileSizeBytes,
      rowCount,
      JSON.stringify({
        source: 'disk_import',
        error: errorMessage,
      }),
    ],
  );
}

async function importCsvFile(filePath, batchSize) {
  const absolutePath = path.resolve(filePath);
  const fileName = path.basename(absolutePath);
  const fileStats = await fs.promises.stat(absolutePath);
  const state = createIngestState();

  let ingestFileId = null;
  let headers = [];
  let batch = [];
  let startRowNumber = 1;

  const parser = csv();
  parser.on('headers', (parsedHeaders) => {
    headers = parsedHeaders;
  });

  try {
    const stream = fs.createReadStream(absolutePath).pipe(parser);

    for await (const row of stream) {
      if (!ingestFileId) {
        ingestFileId = await withClient((client) => beginIngestFile(client, {
          fileName,
          filePath: absolutePath,
          fileSizeBytes: fileStats.size,
          rowCount: null,
          headers: headers.length > 0 ? headers : Object.keys(row),
          metadata: { source: 'disk_import' },
        }));
        state.ingestFileId = ingestFileId;
      }

      batch.push(row);
      state.total++;

      if (batch.length >= batchSize) {
        await runBatch(ingestFileId, batch, startRowNumber, state);
        startRowNumber += batch.length;
        batch = [];
      }
    }

    if (!ingestFileId) {
      ingestFileId = await withClient((client) => beginIngestFile(client, {
        fileName,
        filePath: absolutePath,
        fileSizeBytes: fileStats.size,
        rowCount: 0,
        headers,
        metadata: { source: 'disk_import' },
      }));
      state.ingestFileId = ingestFileId;
    }

    if (batch.length > 0) {
      await runBatch(ingestFileId, batch, startRowNumber, state);
    }

    await withClient(async (client) => {
      await finalizeIngestFile(client, state, {
        ingestFileId,
        rowCount: state.total,
        status: 'loaded',
        metadata: {
          source: 'disk_import',
          file_path: absolutePath,
        },
      });
    });

    return state;
  } catch (error) {
    await markImportFailed({
      ingestFileId,
      fileName,
      filePath: absolutePath,
      fileSizeBytes: fileStats.size,
      rowCount: state.total,
      errorMessage: error.message,
    });
    throw error;
  }
}

async function main() {
  const targetArg = process.argv[2];
  if (!targetArg) {
    usage();
  }

  const targetPath = path.resolve(process.cwd(), targetArg);
  const files = await listCsvFiles(targetPath);

  if (files.length === 0) {
    throw new Error(`No CSV files found under ${targetPath}`);
  }

  logger.info('disk import started', {
    targetPath,
    fileCount: files.length,
    batchSize: DEFAULT_BATCH_SIZE,
  });

  const aggregate = {
    files: 0,
    total: 0,
    inserted: 0,
    skipped: 0,
    rawRowsLinked: 0,
  };

  for (const file of files) {
    logger.info('importing csv file', { file });
    const result = await importCsvFile(file, DEFAULT_BATCH_SIZE);
    aggregate.files++;
    aggregate.total += result.total;
    aggregate.inserted += result.inserted;
    aggregate.skipped += result.skipped;
    aggregate.rawRowsLinked += result.rawRowsLinked;

    console.log(
      JSON.stringify(
        {
          file,
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
  }

  await withClient(async (client) => {
    await refreshAnalyticsCaches(client);
  });

  console.log(
    JSON.stringify(
      {
        filesImported: aggregate.files,
        totalRows: aggregate.total,
        insertedRows: aggregate.inserted,
        skippedRows: aggregate.skipped,
        rawRowsLinked: aggregate.rawRowsLinked,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    logger.error('disk import failed', { error: error.message, stack: error.stack });
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
