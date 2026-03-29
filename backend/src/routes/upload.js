const express  = require('express');
const multer   = require('multer');
const csv      = require('csv-parser');
const stream   = require('stream');
const router   = express.Router();
const db       = require('../db/connection');
const logger   = require('../logger');
const { ingestUploadedAwards } = require('../db/importers/awardsIngest');

// Store uploaded files in memory as a buffer (streaming immediately to DB).
// For very large files the team may switch to disk storage via multer.diskStorage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB per chunk
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'), false);
    }
  },
});

// POST /api/upload
router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Include a CSV as form-data field "file".' });
  }

  logger.info('upload started', {
    requestId: req.id,
    filename:  req.file.originalname,
    sizeBytes: req.file.size,
  });

  const uploadStart = Date.now();
  const client = await db.getClient();
  let ingestFileId = null;

  try {
    await client.query('BEGIN');

    const rows = await new Promise((resolve, reject) => {
      const results = [];
      const readable = new stream.PassThrough();
      readable.end(req.file.buffer);
      readable
        .pipe(csv())
        .on('data', (row) => results.push(row))
        .on('end', () => resolve(results))
        .on('error', reject);
    });

    const stats = await ingestUploadedAwards(client, {
      fileName: req.file.originalname,
      fileSizeBytes: req.file.size,
      rows,
    });
    ingestFileId = stats.ingestFileId;

    await client.query('COMMIT');

    const duration = Date.now() - uploadStart;
    logger.info('upload complete', {
      requestId:  req.id,
      ingestFileId,
      filename:   req.file.originalname,
      total:      stats.total,
      inserted:   stats.inserted,
      skipped:    stats.skipped,
      durationMs: duration,
    });

    res.json({
      message:  'Upload complete',
      ingestFileId,
      inserted: stats.inserted,
      skipped:  stats.skipped,
      total:    stats.total,
      errors:   stats.errors.slice(0, 50),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    try {
      await db.query(
        `INSERT INTO ingest_files (
           ingest_file_id,
           file_name,
           file_size_bytes,
           row_count,
           load_status,
           metadata
         )
         VALUES (
           COALESCE($1, uuid_generate_v4()),
           $2,
           $3,
           0,
           'failed',
           $4::jsonb
         )
         ON CONFLICT (file_name) DO UPDATE
           SET load_status = 'failed',
               metadata = ingest_files.metadata || EXCLUDED.metadata`,
        [
          ingestFileId,
          req.file?.originalname || 'unknown-upload.csv',
          req.file?.size || null,
          JSON.stringify({ error: err.message, requestId: req.id }),
        ],
      );
    } catch (markFailedErr) {
      logger.error('failed to mark ingest file as failed', {
        requestId: req.id,
        ingestFileId,
        error: markFailedErr.message,
      });
    }

    logger.error('upload failed, transaction rolled back', {
      requestId: req.id,
      ingestFileId,
      filename:  req.file?.originalname,
      error:     err.message,
    });
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
