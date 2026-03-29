require('dotenv').config();

const db = require('../connection');
const { refreshAnalyticsCaches } = require('../analyticsCache');

const backfillAwardsSql = `
  UPDATE award_transactions a
     SET number_of_offers_received = COALESCE(
           a.number_of_offers_received,
           CASE
             WHEN COALESCE(
               r.payload->>'awardData.referenced_idv.number_of_offers_received',
               r.payload->>'awardData.number_of_offers_received',
               r.payload->>'awardData.number_of_offers_recieved'
             ) ~ '^\\d+$'
             THEN COALESCE(
               r.payload->>'awardData.referenced_idv.number_of_offers_received',
               r.payload->>'awardData.number_of_offers_received',
               r.payload->>'awardData.number_of_offers_recieved'
             )::INTEGER
           END
         ),
         place_of_performance_congressional_district = COALESCE(
           NULLIF(a.place_of_performance_congressional_district, ''),
           NULLIF(r.payload->>'acquisitionData.place_of_performance.congressional_district', '')
         ),
         place_of_performance_county_code = COALESCE(
           NULLIF(a.place_of_performance_county_code, ''),
           NULLIF(r.payload->>'acquisitionData.place_of_performance.county.code', '')
         ),
         place_of_performance_county_name = COALESCE(
           NULLIF(a.place_of_performance_county_name, ''),
           NULLIF(r.payload->>'acquisitionData.place_of_performance.county.name', '')
         ),
         extra_attributes = a.extra_attributes
           || jsonb_strip_nulls(
             jsonb_build_object(
               'number_of_offers_received',
               COALESCE(
                 a.number_of_offers_received,
                 CASE
                   WHEN COALESCE(
                     r.payload->>'awardData.referenced_idv.number_of_offers_received',
                     r.payload->>'awardData.number_of_offers_received',
                     r.payload->>'awardData.number_of_offers_recieved'
                   ) ~ '^\\d+$'
                   THEN COALESCE(
                     r.payload->>'awardData.referenced_idv.number_of_offers_received',
                     r.payload->>'awardData.number_of_offers_received',
                     r.payload->>'awardData.number_of_offers_recieved'
                   )::INTEGER
                 END
               ),
               'place_of_performance_congressional_district',
               COALESCE(
                 NULLIF(a.place_of_performance_congressional_district, ''),
                 NULLIF(r.payload->>'acquisitionData.place_of_performance.congressional_district', '')
               ),
               'place_of_performance_county_code',
               COALESCE(
                 NULLIF(a.place_of_performance_county_code, ''),
                 NULLIF(r.payload->>'acquisitionData.place_of_performance.county.code', '')
               ),
               'place_of_performance_county_name',
               COALESCE(
                 NULLIF(a.place_of_performance_county_name, ''),
                 NULLIF(r.payload->>'acquisitionData.place_of_performance.county.name', '')
               )
             )
           )
    FROM raw_award_rows r
   WHERE a.raw_award_row_id = r.raw_award_row_id
     AND (
       a.number_of_offers_received IS NULL
       OR a.place_of_performance_congressional_district IS NULL
       OR a.place_of_performance_county_code IS NULL
       OR a.place_of_performance_county_name IS NULL
     );
`;

const backfillVendorSql = `
  WITH vendor_districts AS (
    SELECT
      a.vendor_id,
      MAX(NULLIF(r.payload->>'congressionalDistrict', '')) AS congressional_district
    FROM award_transactions a
    JOIN raw_award_rows r ON r.raw_award_row_id = a.raw_award_row_id
    WHERE NULLIF(r.payload->>'congressionalDistrict', '') IS NOT NULL
    GROUP BY a.vendor_id
  )
  UPDATE vendor_entities v
     SET congressional_district = vd.congressional_district,
         raw_vendor = COALESCE(v.raw_vendor, '{}'::jsonb)
           || jsonb_build_object('congressional_district', vd.congressional_district)
    FROM vendor_districts vd
   WHERE v.vendor_id = vd.vendor_id
     AND (v.congressional_district IS NULL OR BTRIM(v.congressional_district) = '');
`;

async function main() {
  const shouldRefresh = process.argv.includes('--refresh');
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const awardResult = await client.query(backfillAwardsSql);
    const vendorResult = await client.query(backfillVendorSql);

    if (shouldRefresh) {
      await refreshAnalyticsCaches(client);
    }

    await client.query('COMMIT');

    console.log(JSON.stringify({
      ok: true,
      updatedAwards: awardResult.rowCount,
      updatedVendors: vendorResult.rowCount,
      refreshedAnalytics: shouldRefresh,
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
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
