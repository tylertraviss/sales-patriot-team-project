require('dotenv').config();

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const { mapUploadedRow } = require('../importers/awardsIngest');

const DEFAULT_CSV = path.resolve(__dirname, '../../../../data/awards_20100314_20100314.csv');

const CHECKS = [
  {
    label: 'vendor congressional district',
    get: (mapped) => mapped.vendor.congressionalDistrict,
  },
  {
    label: 'number of offers received',
    get: (mapped) => mapped.award.numberOfOffersReceived,
  },
  {
    label: 'place of performance congressional district',
    get: (mapped) => mapped.award.placeOfPerformanceCongressionalDistrict,
  },
  {
    label: 'place of performance county code',
    get: (mapped) => mapped.award.placeOfPerformanceCountyCode,
  },
  {
    label: 'place of performance county name',
    get: (mapped) => mapped.award.placeOfPerformanceCountyName,
  },
];

async function main() {
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV;

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const remaining = new Set(CHECKS.map((check) => check.label));
  let rowsRead = 0;

  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        rowsRead += 1;

        const mapped = mapUploadedRow(row);
        for (const check of CHECKS) {
          if (!remaining.has(check.label)) {
            continue;
          }

          const value = check.get(mapped);
          if (value !== null && value !== undefined && value !== '') {
            remaining.delete(check.label);
          }
        }

        if (remaining.size === 0) {
          resolve();
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  const missing = CHECKS.filter((check) => remaining.has(check.label)).map((check) => check.label);

  console.log(JSON.stringify({
    csvPath,
    rowsRead,
    ok: missing.length === 0,
    missing,
  }, null, 2));

  if (missing.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
