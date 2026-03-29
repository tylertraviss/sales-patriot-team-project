require('dotenv').config();

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const DEFAULT_CSV = path.resolve(__dirname, '../../../../data/awards_20100314_20100314.csv');

const REQUIRED_FIELDS = [
  'congressionalDistrict',
  'awardData.referenced_idv.number_of_offers_received',
  'acquisitionData.place_of_performance.congressional_district',
  'acquisitionData.place_of_performance.county.code',
  'acquisitionData.place_of_performance.county.name',
];

const COVERAGE_MAP = {
  congressionalDistrict: 'vendor_entities.congressional_district',
  'awardData.referenced_idv.number_of_offers_received': 'award_transactions.number_of_offers_received',
  'acquisitionData.place_of_performance.congressional_district': 'award_transactions.place_of_performance_congressional_district',
  'acquisitionData.place_of_performance.county.code': 'award_transactions.place_of_performance_county_code',
  'acquisitionData.place_of_performance.county.name': 'award_transactions.place_of_performance_county_name',
};

function readHeaders(csvPath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(csvPath).pipe(csv());

    stream.on('headers', (headers) => {
      stream.destroy();
      resolve(headers);
    });
    stream.on('error', reject);
  });
}

async function main() {
  const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CSV;
  const headers = await readHeaders(csvPath);
  const missing = REQUIRED_FIELDS.filter((field) => !headers.includes(field));

  const report = REQUIRED_FIELDS.map((field) => ({
    csvField: field,
    presentInCsv: headers.includes(field),
    mappedTo: COVERAGE_MAP[field] || null,
  }));

  console.log(JSON.stringify({
    csvPath,
    requiredFields: report,
    ok: missing.length === 0,
    missing,
  }, null, 2));

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
