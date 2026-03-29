const express  = require('express');
const multer   = require('multer');
const csv      = require('csv-parser');
const stream   = require('stream');
const router   = express.Router();
const db       = require('../db/connection');

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

/**
 * Maps a raw CSV row object to the DB columns we care about.
 * Adjust the field name aliases here to match the actual DLA export format.
 */
function mapRow(row) {
  return {
    cage_code:       (row['CAGE Code']       || row['cage_code']       || '').trim().toUpperCase(),
    company_name:    (row['Company Name']    || row['company_name']    || '').trim(),
    contract_number: (row['Contract Number'] || row['contract_number'] || '').trim(),
    award_amount:    parseFloat(row['Award Amount'] || row['award_amount'] || '0') || 0,
    award_date:      row['Award Date']  || row['award_date']  || null,
    dla_office:      (row['DLA Office'] || row['dla_office'] || '').trim(),
    description:     (row['Description']     || row['description']     || '').trim(),
  };
}

// POST /api/upload
router.post('/', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Include a CSV as form-data field "file".' });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    let inserted   = 0;
    let skipped    = 0;
    const errors   = [];

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

    for (const raw of rows) {
      const row = mapRow(raw);

      if (!row.cage_code) {
        skipped++;
        errors.push({ row: raw, reason: 'Missing CAGE code' });
        continue;
      }

      try {
        // Upsert company
        await client.query(
          `INSERT INTO companies (cage_code, company_name)
           VALUES ($1, $2)
           ON CONFLICT (cage_code) DO UPDATE
             SET company_name = EXCLUDED.company_name`,
          [row.cage_code, row.company_name || 'Unknown'],
        );

        // Insert award
        await client.query(
          `INSERT INTO awards
             (cage_code, award_amount, award_date, contract_number, description, dla_office)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            row.cage_code,
            row.award_amount || null,
            row.award_date   || null,
            row.contract_number || null,
            row.description  || null,
            row.dla_office   || null,
          ],
        );

        inserted++;
      } catch (rowErr) {
        skipped++;
        errors.push({ row: raw, reason: rowErr.message });
      }
    }

    await client.query('COMMIT');

    res.json({
      message:  'Upload complete',
      inserted,
      skipped,
      total:    rows.length,
      errors:   errors.slice(0, 50), // cap error list in response
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
