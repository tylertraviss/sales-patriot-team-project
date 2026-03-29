const crypto = require('crypto');
const { refreshAnalyticsCaches } = require('../analyticsCache');
const logger = require('../../logger');

const FORCE_ROW_BY_ROW_IMPORT = ['1', 'true', 'yes', 'on']
  .includes(String(process.env.IMPORT_FORCE_ROW_BY_ROW || '').trim().toLowerCase());

const EMPTY_STRING_VALUES = new Set(['', 'null', 'NULL', 'undefined', 'UNDEFINED']);

function cleanValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const stringValue = String(value).trim();
  if (EMPTY_STRING_VALUES.has(stringValue)) {
    return null;
  }

  return stringValue;
}

function pickFirst(row, keys, { upper = false } = {}) {
  for (const key of keys) {
    const value = cleanValue(row[key]);
    if (value !== null) {
      return upper ? value.toUpperCase() : value;
    }
  }

  return null;
}

function parseNumeric(value) {
  const cleaned = cleanValue(value);
  if (cleaned === null) {
    return null;
  }

  const numeric = Number(cleaned.replace(/[$,]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseInteger(value) {
  const cleaned = cleanValue(value);
  if (cleaned === null) {
    return null;
  }

  const integer = Number.parseInt(cleaned, 10);
  return Number.isFinite(integer) ? integer : null;
}

function parseDate(value) {
  const cleaned = cleanValue(value);
  if (cleaned === null) {
    return null;
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeBoundedCode(value, maxLength = 10) {
  const cleaned = cleanValue(value);
  if (cleaned === null) {
    return null;
  }

  const normalized = cleaned.toUpperCase();
  if (normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (typeof value === 'string' && value.trim() === '') {
        return false;
      }

      return true;
    }),
  );
}

function hashObject(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}

function parseCsvPeriod(fileName) {
  const match = /awards_(\d{8})_(\d{8})\.csv$/i.exec(fileName || '');
  if (!match) {
    return { periodStart: null, periodEnd: null };
  }

  const [periodStart, periodEnd] = match.slice(1).map((value) => {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  });

  return { periodStart, periodEnd };
}

function buildVendorKey(vendor) {
  if (vendor.cageCode) {
    return `CAGE:${vendor.cageCode}`;
  }

  if (vendor.uei) {
    return `UEI:${vendor.uei}`;
  }

  const normalizedName = (vendor.vendorName || 'UNKNOWN')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  return `NAME:${normalizedName}:${vendor.countryCode || 'XX'}:${vendor.stateCode || 'XX'}`;
}

function buildAwardKey(award, vendorKey) {
  if (award.contractId) {
    return `CONTRACT:${award.contractId}`;
  }

  if (award.acquisitionId) {
    return `ACQ:${award.acquisitionId}`;
  }

  return [
    'FALLBACK',
    award.piid || '',
    award.modificationNumber || '',
    award.transactionNumber || '',
    vendorKey,
    award.awardDate || '',
    award.awardAmount ?? '',
  ].join(':');
}

function buildRawVendorPatch(vendor) {
  return compactObject({
    parent_company_name: vendor.parentCompanyName,
    parent_uei: vendor.parentUei,
    ultimate_uei: vendor.ultimateUei,
    ultimate_uei_name: vendor.ultimateUeiName,
    vendor_phone_number: vendor.vendorPhoneNumber,
    vendor_fax_number: vendor.vendorFaxNumber,
    source_vendor_info_id: vendor.sourceVendorInfoId,
    source_vendor_history_id: vendor.sourceVendorHistoryId,
  });
}

function mapUploadedRow(rawRow) {
  const vendorStateCode = normalizeBoundedCode(
    pickFirst(rawRow, ['vendorData.state_of_incorporation.code', 'stateCode'], { upper: true }),
    10,
  );
  const vendorStateName = pickFirst(rawRow, ['stateName', 'vendorData.state_of_incorporation.name'])
    || pickFirst(rawRow, ['stateCode']);
  const vendorCountryCode = normalizeBoundedCode(
    pickFirst(rawRow, ['countryCode', 'vendorData.country_of_incorporation.code'], { upper: true }),
    10,
  );

  const vendor = {
    cageCode: pickFirst(rawRow, ['CAGE Code', 'cage_code', 'cageCode', 'vendorData.cage_code'], { upper: true }),
    uei: pickFirst(rawRow, ['vendorUei', 'uei', 'UEI', 'vendor_uei'], { upper: true }),
    vendorName: pickFirst(rawRow, [
      'vendorName',
      'Company Name',
      'company_name',
      'vendor_name',
      'vendorData.contractor_name',
      'vendorData.vendor_legal_organization_name',
    ]) || 'Unknown vendor',
    parentCompanyName: pickFirst(rawRow, ['parentCompanyName', 'vendorData.parent_vendor.vendor_name']),
    parentUei: pickFirst(rawRow, ['parentUei'], { upper: true }),
    ultimateUei: pickFirst(rawRow, ['vendorData.ultimate_uei'], { upper: true }),
    ultimateUeiName: pickFirst(rawRow, ['vendorData.ultimate_uei_name']),
    businessTypeDescription: pickFirst(rawRow, [
      'businessTypeDescription',
      'vendorData.organizational_type',
    ]),
    socioEconomicIndicator: pickFirst(rawRow, ['socioEconomicIndicator', 'socioEconomicIndicatorArray']),
    vendorPhoneNumber: pickFirst(rawRow, ['vendorData.vendor_phone_number']),
    vendorFaxNumber: pickFirst(rawRow, ['vendorData.vendor_fax_number']),
    annualRevenue: parseNumeric(pickFirst(rawRow, ['vendorData.annual_revenue', 'annualRevenue'])),
    numberOfEmployees: parseInteger(pickFirst(rawRow, ['vendorData.number_of_employees', 'numberOfEmployees'])),
    vendorRegistrationDate: parseDate(pickFirst(rawRow, ['vendorData.vendor_registration_date'])),
    vendorRenewalDate: parseDate(pickFirst(rawRow, ['vendorData.vendor_renewal_date'])),
    city: pickFirst(rawRow, ['city']),
    stateCode: vendorStateCode,
    stateName: vendorStateName,
    zipCode: pickFirst(rawRow, ['zipcode', 'zipCode']),
    countryCode: vendorCountryCode,
    countryName: pickFirst(rawRow, ['countryName', 'vendorData.country_of_incorporation.name']),
    sourceVendorInfoId: pickFirst(rawRow, ['vendorInfoId']),
    sourceVendorHistoryId: pickFirst(rawRow, ['vendorHistoryId']),
  };

  vendor.vendorKey = buildVendorKey(vendor);

  const awardDate = parseDate(pickFirst(rawRow, ['Award Date', 'award_date', 'awardDate', 'dateSigned', 'date_signed_txt']));
  const dateSigned = parseDate(pickFirst(rawRow, ['dateSigned', 'date_signed_txt', 'Award Date', 'award_date']));

  const award = {
    contractId: pickFirst(rawRow, ['contractId']),
    acquisitionId: pickFirst(rawRow, ['acquisitionId']),
    sourceVendorInfoId: vendor.sourceVendorInfoId,
    sourceVendorHistoryId: vendor.sourceVendorHistoryId,
    piid: pickFirst(rawRow, ['piid', 'Contract Number', 'contract_number']),
    referencePiid: pickFirst(rawRow, ['referencePiid']),
    contractNumber: pickFirst(rawRow, ['Contract Number', 'contract_number', 'piid']),
    modificationNumber: pickFirst(rawRow, ['modificationNumber']),
    referenceModificationNumber: pickFirst(rawRow, ['referenceModificationNumber']),
    transactionNumber: pickFirst(rawRow, ['transactionNumber']),
    awardOrIdv: pickFirst(rawRow, ['awardOrIdv']),
    awardType: pickFirst(rawRow, ['awardType'], { upper: true }),
    awardTypeDescription: pickFirst(rawRow, ['awardTypeDescription']),
    awardStatus: pickFirst(rawRow, ['awardStatus', 'status']),
    totalActions: parseInteger(pickFirst(rawRow, ['awardData.total_actions', 'totalActions'])),
    numberOfActions: parseInteger(pickFirst(rawRow, ['numberOfActions', 'awardData.number_of_actions'])),
    awardAmount: parseNumeric(pickFirst(rawRow, ['dollarsObligated', 'Award Amount', 'award_amount'])),
    totalContractValue: parseNumeric(pickFirst(rawRow, ['totalContractValue'])),
    baseAndExercisedOptionsValue: parseNumeric(pickFirst(rawRow, ['baseAndExercisedOptionsValue'])),
    awardDate,
    dateSigned,
    revealDate: parseDate(pickFirst(rawRow, ['revealDate'])),
    solicitationDate: parseDate(pickFirst(rawRow, ['solicitationDate', 'solicitation_date'])),
    periodOfPerformanceStartDate: parseDate(pickFirst(rawRow, ['periodOfPerformanceStartDate', 'awardData.period_of_performance_start_date'])),
    currentCompletionDate: parseDate(pickFirst(rawRow, ['currentCompletionDate', 'awardData.current_completion_date'])),
    awardUltimateCompletionDate: parseDate(pickFirst(rawRow, ['awardUltimateCompletionDate', 'awardData.award_ultimate_completion_date'])),
    awardFiscalYear: parseInteger(pickFirst(rawRow, ['acquisitionData.award_fiscal_year', 'fiscalYear']))
      || (awardDate ? Number.parseInt(awardDate.slice(0, 4), 10) : null),
    contractFiscalYear: parseInteger(pickFirst(rawRow, ['acquisitionData.contract_fiscal_year']))
      || (dateSigned ? Number.parseInt(dateSigned.slice(0, 4), 10) : null),
    naicsCode: pickFirst(rawRow, ['naicsCode'], { upper: true }),
    naicsDescription: pickFirst(rawRow, ['naicsDescription']),
    productServiceCode: pickFirst(rawRow, ['productOrServiceCode', 'acquisitionData.product_or_service_code.code'], { upper: true }),
    productServiceDescription: pickFirst(rawRow, [
      'awardData.product_or_service_code.name',
      'acquisitionData.product_or_service_code.name',
    ]),
    productOrServiceType: pickFirst(rawRow, ['productOrServiceType']),
    descriptionOfRequirement: pickFirst(rawRow, ['descriptionOfRequirement', 'Description', 'description']),
    businessTypeDescription: vendor.businessTypeDescription,
    socioEconomicIndicator: vendor.socioEconomicIndicator,
    extentCompetedCode: pickFirst(rawRow, ['acquisitionData.extent_competed.code'], { upper: true }),
    extentCompetedName: pickFirst(rawRow, ['acquisitionData.extent_competed.name']),
    setAsideCode: pickFirst(rawRow, ['acquisitionData.set_aside_type.code', 'setAsideType'], { upper: true }),
    setAsideName: pickFirst(rawRow, ['acquisitionData.set_aside_type.name']),
    contractingDepartmentCode: pickFirst(rawRow, ['acquisitionData.organization_info.contracting_department.code'], { upper: true }),
    contractingDepartmentName: pickFirst(rawRow, ['acquisitionData.organization_info.contracting_department.name']),
    contractingAgencyCode: pickFirst(rawRow, ['acquisitionData.organization_info.contracting_agency.code', 'agencyCode'], { upper: true }),
    contractingAgencyName: pickFirst(rawRow, ['acquisitionData.organization_info.contracting_agency.name']),
    contractingOfficeCode: pickFirst(rawRow, ['acquisitionData.organization_info.contracting_office.code'], { upper: true }),
    contractingOfficeName: pickFirst(rawRow, ['acquisitionData.organization_info.contracting_office.name', 'DLA Office', 'dla_office']),
    fundingDepartmentCode: pickFirst(rawRow, ['acquisitionData.organization_info.funding_department.code'], { upper: true }),
    fundingDepartmentName: pickFirst(rawRow, ['acquisitionData.organization_info.funding_department.name']),
    fundingAgencyCode: pickFirst(rawRow, ['acquisitionData.organization_info.funding_agency.code'], { upper: true }),
    fundingAgencyName: pickFirst(rawRow, ['acquisitionData.organization_info.funding_agency.name']),
    fundingOfficeCode: pickFirst(rawRow, ['acquisitionData.organization_info.funding_office.code'], { upper: true }),
    fundingOfficeName: pickFirst(rawRow, ['acquisitionData.organization_info.funding_office.name']),
    placeOfPerformanceCity: pickFirst(rawRow, ['acquisitionData.place_of_performance.city.name']),
    placeOfPerformanceStateCode: pickFirst(rawRow, ['acquisitionData.place_of_performance.state.code'], { upper: true }),
    placeOfPerformanceStateName: pickFirst(rawRow, ['acquisitionData.place_of_performance.state.name']),
    placeOfPerformanceCountryCode: pickFirst(rawRow, ['acquisitionData.place_of_performance.country.code'], { upper: true }),
    placeOfPerformanceCountryName: pickFirst(rawRow, ['acquisitionData.place_of_performance.country.name']),
    placeOfPerformanceZip: pickFirst(rawRow, ['acquisitionData.place_of_performance.zip']),
  };

  award.awardKey = buildAwardKey(award, vendor.vendorKey);
  award.extraAttributes = compactObject({
    section: pickFirst(rawRow, ['section']),
    vendorSource: pickFirst(rawRow, ['vendorSource']),
    referenceAgencyCode: pickFirst(rawRow, ['referenceAgencyCode']),
    activeIndicator: pickFirst(rawRow, ['activeIndicator']),
    batchId: pickFirst(rawRow, ['batchId', 'batch_id']),
  });

  return { vendor, award };
}

function prepareBulkRow(rawRow, sourceRowNumber) {
  const mapped = mapUploadedRow(rawRow);

  if (!mapped.vendor.vendorKey || !mapped.award.awardKey) {
    return {
      valid: false,
      error: { rowNumber: sourceRowNumber, reason: 'Missing vendor or award identity' },
    };
  }

  return {
    valid: true,
    row: {
      source_row_number: sourceRowNumber,
      source_row_hash: hashObject(rawRow),
      payload: rawRow,
      contract_id: mapped.award.contractId,
      acquisition_id: mapped.award.acquisitionId,
      vendor_uei: mapped.vendor.uei,
      vendor_name: mapped.vendor.vendorName,
      award_date: mapped.award.awardDate,
      reveal_date: mapped.award.revealDate,
      input_vendor_key: mapped.vendor.vendorKey,
      cage_code: mapped.vendor.cageCode,
      uei: mapped.vendor.uei,
      business_type_description: mapped.vendor.businessTypeDescription,
      socio_economic_indicator: mapped.vendor.socioEconomicIndicator,
      parent_company_name: mapped.vendor.parentCompanyName,
      parent_uei: mapped.vendor.parentUei,
      ultimate_uei: mapped.vendor.ultimateUei,
      ultimate_uei_name: mapped.vendor.ultimateUeiName,
      vendor_phone_number: mapped.vendor.vendorPhoneNumber,
      vendor_fax_number: mapped.vendor.vendorFaxNumber,
      annual_revenue: mapped.vendor.annualRevenue,
      number_of_employees: mapped.vendor.numberOfEmployees,
      vendor_registration_date: mapped.vendor.vendorRegistrationDate,
      vendor_renewal_date: mapped.vendor.vendorRenewalDate,
      city: mapped.vendor.city,
      state_code: mapped.vendor.stateCode,
      state_name: mapped.vendor.stateName,
      zip_code: mapped.vendor.zipCode,
      country_code: mapped.vendor.countryCode,
      country_name: mapped.vendor.countryName,
      source_vendor_info_id: mapped.vendor.sourceVendorInfoId,
      source_vendor_history_id: mapped.vendor.sourceVendorHistoryId,
      raw_vendor: buildRawVendorPatch(mapped.vendor),
      award_key: mapped.award.awardKey,
      piid: mapped.award.piid,
      reference_piid: mapped.award.referencePiid,
      contract_number: mapped.award.contractNumber,
      modification_number: mapped.award.modificationNumber,
      reference_modification_number: mapped.award.referenceModificationNumber,
      transaction_number: mapped.award.transactionNumber,
      award_or_idv: mapped.award.awardOrIdv,
      award_type: mapped.award.awardType,
      award_type_description: mapped.award.awardTypeDescription,
      award_status: mapped.award.awardStatus,
      total_actions: mapped.award.totalActions,
      number_of_actions: mapped.award.numberOfActions,
      award_amount: mapped.award.awardAmount,
      total_contract_value: mapped.award.totalContractValue,
      base_and_exercised_options_value: mapped.award.baseAndExercisedOptionsValue,
      date_signed: mapped.award.dateSigned,
      solicitation_date: mapped.award.solicitationDate,
      period_of_performance_start_date: mapped.award.periodOfPerformanceStartDate,
      current_completion_date: mapped.award.currentCompletionDate,
      award_ultimate_completion_date: mapped.award.awardUltimateCompletionDate,
      award_fiscal_year: mapped.award.awardFiscalYear,
      contract_fiscal_year: mapped.award.contractFiscalYear,
      naics_code: mapped.award.naicsCode,
      naics_description: mapped.award.naicsDescription,
      product_service_code: mapped.award.productServiceCode,
      product_service_description: mapped.award.productServiceDescription,
      product_or_service_type: mapped.award.productOrServiceType,
      description_of_requirement: mapped.award.descriptionOfRequirement,
      extent_competed_code: mapped.award.extentCompetedCode,
      extent_competed_name: mapped.award.extentCompetedName,
      set_aside_code: mapped.award.setAsideCode,
      set_aside_name: mapped.award.setAsideName,
      contracting_department_code: mapped.award.contractingDepartmentCode,
      contracting_department_name: mapped.award.contractingDepartmentName,
      contracting_agency_code: mapped.award.contractingAgencyCode,
      contracting_agency_name: mapped.award.contractingAgencyName,
      contracting_office_code: mapped.award.contractingOfficeCode,
      contracting_office_name: mapped.award.contractingOfficeName,
      funding_department_code: mapped.award.fundingDepartmentCode,
      funding_department_name: mapped.award.fundingDepartmentName,
      funding_agency_code: mapped.award.fundingAgencyCode,
      funding_agency_name: mapped.award.fundingAgencyName,
      funding_office_code: mapped.award.fundingOfficeCode,
      funding_office_name: mapped.award.fundingOfficeName,
      place_of_performance_city: mapped.award.placeOfPerformanceCity,
      place_of_performance_state_code: mapped.award.placeOfPerformanceStateCode,
      place_of_performance_state_name: mapped.award.placeOfPerformanceStateName,
      place_of_performance_country_code: mapped.award.placeOfPerformanceCountryCode,
      place_of_performance_country_name: mapped.award.placeOfPerformanceCountryName,
      place_of_performance_zip: mapped.award.placeOfPerformanceZip,
      extra_attributes: mapped.award.extraAttributes,
    },
  };
}

const BULK_INGEST_SQL = `
WITH input_rows AS (
  SELECT *
    FROM jsonb_to_recordset($1::jsonb) AS rows(
      source_row_number BIGINT,
      source_row_hash TEXT,
      payload JSONB,
      contract_id TEXT,
      acquisition_id TEXT,
      vendor_uei TEXT,
      vendor_name TEXT,
      award_date DATE,
      reveal_date DATE,
      input_vendor_key TEXT,
      cage_code VARCHAR(10),
      uei VARCHAR(20),
      business_type_description TEXT,
      socio_economic_indicator TEXT,
      parent_company_name TEXT,
      parent_uei TEXT,
      ultimate_uei TEXT,
      ultimate_uei_name TEXT,
      vendor_phone_number TEXT,
      vendor_fax_number TEXT,
      annual_revenue NUMERIC(18, 2),
      number_of_employees INTEGER,
      vendor_registration_date DATE,
      vendor_renewal_date DATE,
      city TEXT,
      state_code TEXT,
      state_name TEXT,
      zip_code TEXT,
      country_code TEXT,
      country_name TEXT,
      source_vendor_info_id TEXT,
      source_vendor_history_id TEXT,
      raw_vendor JSONB,
      award_key TEXT,
      piid TEXT,
      reference_piid TEXT,
      contract_number TEXT,
      modification_number TEXT,
      reference_modification_number TEXT,
      transaction_number TEXT,
      award_or_idv TEXT,
      award_type TEXT,
      award_type_description TEXT,
      award_status TEXT,
      total_actions INTEGER,
      number_of_actions INTEGER,
      award_amount NUMERIC(18, 2),
      total_contract_value NUMERIC(18, 2),
      base_and_exercised_options_value NUMERIC(18, 2),
      date_signed DATE,
      solicitation_date DATE,
      period_of_performance_start_date DATE,
      current_completion_date DATE,
      award_ultimate_completion_date DATE,
      award_fiscal_year INTEGER,
      contract_fiscal_year INTEGER,
      naics_code VARCHAR(10),
      naics_description TEXT,
      product_service_code VARCHAR(10),
      product_service_description TEXT,
      product_or_service_type TEXT,
      description_of_requirement TEXT,
      extent_competed_code TEXT,
      extent_competed_name TEXT,
      set_aside_code TEXT,
      set_aside_name TEXT,
      contracting_department_code TEXT,
      contracting_department_name TEXT,
      contracting_agency_code TEXT,
      contracting_agency_name TEXT,
      contracting_office_code TEXT,
      contracting_office_name TEXT,
      funding_department_code TEXT,
      funding_department_name TEXT,
      funding_agency_code TEXT,
      funding_agency_name TEXT,
      funding_office_code TEXT,
      funding_office_name TEXT,
      place_of_performance_city TEXT,
      place_of_performance_state_code TEXT,
      place_of_performance_state_name TEXT,
      place_of_performance_country_code TEXT,
      place_of_performance_country_name TEXT,
      place_of_performance_zip TEXT,
      extra_attributes JSONB
    )
),
valid_rows AS (
  SELECT *
    FROM input_rows
   WHERE input_vendor_key IS NOT NULL
     AND award_key IS NOT NULL
),
distinct_vendors AS (
  SELECT DISTINCT ON (input_vendor_key) *
    FROM valid_rows
   ORDER BY input_vendor_key, source_row_number DESC
),
insert_naics AS (
  INSERT INTO naics_codes (code, description)
  SELECT DISTINCT naics_code, COALESCE(naics_description, 'Unknown')
    FROM valid_rows
   WHERE naics_code IS NOT NULL
     AND BTRIM(naics_code) <> ''
  ON CONFLICT (code) DO NOTHING
),
insert_product_service_codes AS (
  INSERT INTO product_service_codes (code, description)
  SELECT DISTINCT product_service_code, COALESCE(product_service_description, product_or_service_type, 'Unknown')
    FROM valid_rows
   WHERE product_service_code IS NOT NULL
     AND BTRIM(product_service_code) <> ''
  ON CONFLICT (code) DO NOTHING
),
matched_vendors AS (
  SELECT dv.input_vendor_key, matched.vendor_id
    FROM distinct_vendors dv
    LEFT JOIN LATERAL (
      SELECT ve.vendor_id
        FROM vendor_entities ve
       WHERE (dv.cage_code IS NOT NULL AND ve.cage_code = dv.cage_code)
          OR (dv.uei IS NOT NULL AND ve.uei = dv.uei)
          OR ve.vendor_key = dv.input_vendor_key
       ORDER BY CASE
         WHEN dv.cage_code IS NOT NULL AND ve.cage_code = dv.cage_code THEN 0
         WHEN dv.uei IS NOT NULL AND ve.uei = dv.uei THEN 1
         ELSE 2
       END
       LIMIT 1
    ) matched ON TRUE
),
matched_vendor_rows AS (
  SELECT DISTINCT ON (mv.vendor_id)
         mv.vendor_id,
         dv.*
    FROM matched_vendors mv
    JOIN distinct_vendors dv ON dv.input_vendor_key = mv.input_vendor_key
   WHERE mv.vendor_id IS NOT NULL
   ORDER BY mv.vendor_id, dv.source_row_number DESC
),
updated_vendors AS (
  UPDATE vendor_entities ve
     SET vendor_name = COALESCE(NULLIF(mvr.vendor_name, ''), ve.vendor_name),
         business_type_description = COALESCE(NULLIF(mvr.business_type_description, ''), ve.business_type_description),
         socio_economic_indicator = COALESCE(NULLIF(mvr.socio_economic_indicator, ''), ve.socio_economic_indicator),
         parent_company_name = COALESCE(NULLIF(mvr.parent_company_name, ''), ve.parent_company_name),
         parent_uei = COALESCE(NULLIF(mvr.parent_uei, ''), ve.parent_uei),
         ultimate_uei = COALESCE(NULLIF(mvr.ultimate_uei, ''), ve.ultimate_uei),
         ultimate_uei_name = COALESCE(NULLIF(mvr.ultimate_uei_name, ''), ve.ultimate_uei_name),
         vendor_phone_number = COALESCE(NULLIF(mvr.vendor_phone_number, ''), ve.vendor_phone_number),
         vendor_fax_number = COALESCE(NULLIF(mvr.vendor_fax_number, ''), ve.vendor_fax_number),
         annual_revenue = COALESCE(mvr.annual_revenue, ve.annual_revenue),
         number_of_employees = COALESCE(mvr.number_of_employees, ve.number_of_employees),
         vendor_registration_date = COALESCE(mvr.vendor_registration_date, ve.vendor_registration_date),
         vendor_renewal_date = COALESCE(mvr.vendor_renewal_date, ve.vendor_renewal_date),
         city = COALESCE(NULLIF(mvr.city, ''), ve.city),
         state_code = COALESCE(NULLIF(mvr.state_code, ''), ve.state_code),
         state_name = COALESCE(NULLIF(mvr.state_name, ''), ve.state_name),
         zip_code = COALESCE(NULLIF(mvr.zip_code, ''), ve.zip_code),
         country_code = COALESCE(NULLIF(mvr.country_code, ''), ve.country_code),
         country_name = COALESCE(NULLIF(mvr.country_name, ''), ve.country_name),
         source_vendor_info_id = COALESCE(NULLIF(mvr.source_vendor_info_id, ''), ve.source_vendor_info_id),
         source_vendor_history_id = COALESCE(NULLIF(mvr.source_vendor_history_id, ''), ve.source_vendor_history_id),
         raw_vendor = COALESCE(ve.raw_vendor, '{}'::jsonb) || COALESCE(mvr.raw_vendor, '{}'::jsonb)
    FROM matched_vendor_rows mvr
   WHERE ve.vendor_id = mvr.vendor_id
  RETURNING ve.vendor_id
),
inserted_vendors AS (
  INSERT INTO vendor_entities (
    vendor_key,
    cage_code,
    uei,
    vendor_name,
    business_type_description,
    socio_economic_indicator,
    parent_company_name,
    parent_uei,
    ultimate_uei,
    ultimate_uei_name,
    vendor_phone_number,
    vendor_fax_number,
    annual_revenue,
    number_of_employees,
    vendor_registration_date,
    vendor_renewal_date,
    city,
    state_code,
    state_name,
    zip_code,
    country_code,
    country_name,
    source_vendor_info_id,
    source_vendor_history_id,
    raw_vendor
  )
  SELECT
    dv.input_vendor_key,
    dv.cage_code,
    dv.uei,
    dv.vendor_name,
    dv.business_type_description,
    dv.socio_economic_indicator,
    dv.parent_company_name,
    dv.parent_uei,
    dv.ultimate_uei,
    dv.ultimate_uei_name,
    dv.vendor_phone_number,
    dv.vendor_fax_number,
    dv.annual_revenue,
    dv.number_of_employees,
    dv.vendor_registration_date,
    dv.vendor_renewal_date,
    dv.city,
    dv.state_code,
    dv.state_name,
    dv.zip_code,
    dv.country_code,
    dv.country_name,
    dv.source_vendor_info_id,
    dv.source_vendor_history_id,
    COALESCE(dv.raw_vendor, '{}'::jsonb)
  FROM distinct_vendors dv
  LEFT JOIN matched_vendors mv ON mv.input_vendor_key = dv.input_vendor_key
  WHERE mv.vendor_id IS NULL
  ON CONFLICT DO NOTHING
  RETURNING vendor_key, vendor_id, cage_code, uei
),
resolved_vendors AS (
  SELECT
    dv.input_vendor_key,
    COALESCE(mv.vendor_id, iv.vendor_id, inserted_match.vendor_id, resolved.vendor_id) AS vendor_id
  FROM distinct_vendors dv
  LEFT JOIN matched_vendors mv ON mv.input_vendor_key = dv.input_vendor_key
  LEFT JOIN inserted_vendors iv ON iv.vendor_key = dv.input_vendor_key
  LEFT JOIN LATERAL (
    SELECT ins.vendor_id
      FROM inserted_vendors ins
     WHERE (dv.cage_code IS NOT NULL AND ins.cage_code = dv.cage_code)
        OR (dv.uei IS NOT NULL AND ins.uei = dv.uei)
        OR ins.vendor_key = dv.input_vendor_key
     ORDER BY CASE
       WHEN dv.cage_code IS NOT NULL AND ins.cage_code = dv.cage_code THEN 0
       WHEN dv.uei IS NOT NULL AND ins.uei = dv.uei THEN 1
       ELSE 2
     END
     LIMIT 1
  ) inserted_match ON TRUE
  LEFT JOIN LATERAL (
    SELECT ve.vendor_id
      FROM vendor_entities ve
     WHERE (dv.cage_code IS NOT NULL AND ve.cage_code = dv.cage_code)
        OR (dv.uei IS NOT NULL AND ve.uei = dv.uei)
        OR ve.vendor_key = dv.input_vendor_key
     ORDER BY CASE
       WHEN dv.cage_code IS NOT NULL AND ve.cage_code = dv.cage_code THEN 0
       WHEN dv.uei IS NOT NULL AND ve.uei = dv.uei THEN 1
       ELSE 2
     END
     LIMIT 1
  ) resolved ON TRUE
),
inserted_raw_rows AS (
  INSERT INTO raw_award_rows (
    ingest_file_id,
    source_row_number,
    source_row_hash,
    contract_id,
    acquisition_id,
    vendor_uei,
    vendor_name,
    award_date,
    reveal_date,
    payload
  )
  SELECT
    $2::uuid,
    source_row_number,
    source_row_hash,
    contract_id,
    acquisition_id,
    vendor_uei,
    vendor_name,
    award_date,
    reveal_date,
    payload
  FROM valid_rows
  ON CONFLICT DO NOTHING
  RETURNING source_row_hash, raw_award_row_id
),
resolved_raw_rows AS (
  SELECT
    vr.source_row_number,
    vr.award_key,
    COALESCE(irr.raw_award_row_id, rar.raw_award_row_id) AS raw_award_row_id
  FROM valid_rows vr
  LEFT JOIN inserted_raw_rows irr ON irr.source_row_hash = vr.source_row_hash
  LEFT JOIN raw_award_rows rar ON rar.source_row_hash = vr.source_row_hash
),
distinct_awards AS (
  SELECT DISTINCT ON (vr.award_key)
         vr.*,
         rv.vendor_id,
         rrr.raw_award_row_id
    FROM valid_rows vr
    JOIN resolved_vendors rv ON rv.input_vendor_key = vr.input_vendor_key
    LEFT JOIN resolved_raw_rows rrr
      ON rrr.source_row_number = vr.source_row_number
     AND rrr.award_key = vr.award_key
   WHERE rv.vendor_id IS NOT NULL
   ORDER BY vr.award_key, vr.source_row_number DESC
),
upsert_awards AS (
  INSERT INTO award_transactions (
    award_key,
    ingest_file_id,
    raw_award_row_id,
    vendor_id,
    contract_id,
    acquisition_id,
    source_vendor_info_id,
    source_vendor_history_id,
    piid,
    reference_piid,
    contract_number,
    modification_number,
    reference_modification_number,
    transaction_number,
    award_or_idv,
    award_type,
    award_type_description,
    award_status,
    total_actions,
    number_of_actions,
    award_amount,
    total_contract_value,
    base_and_exercised_options_value,
    award_date,
    date_signed,
    reveal_date,
    solicitation_date,
    period_of_performance_start_date,
    current_completion_date,
    award_ultimate_completion_date,
    award_fiscal_year,
    contract_fiscal_year,
    naics_code,
    naics_description,
    product_service_code,
    product_service_description,
    product_or_service_type,
    description_of_requirement,
    business_type_description,
    socio_economic_indicator,
    extent_competed_code,
    extent_competed_name,
    set_aside_code,
    set_aside_name,
    contracting_department_code,
    contracting_department_name,
    contracting_agency_code,
    contracting_agency_name,
    contracting_office_code,
    contracting_office_name,
    funding_department_code,
    funding_department_name,
    funding_agency_code,
    funding_agency_name,
    funding_office_code,
    funding_office_name,
    place_of_performance_city,
    place_of_performance_state_code,
    place_of_performance_state_name,
    place_of_performance_country_code,
    place_of_performance_country_name,
    place_of_performance_zip,
    extra_attributes
  )
  SELECT
    award_key,
    $2::uuid,
    raw_award_row_id,
    vendor_id,
    contract_id,
    acquisition_id,
    source_vendor_info_id,
    source_vendor_history_id,
    piid,
    reference_piid,
    contract_number,
    modification_number,
    reference_modification_number,
    transaction_number,
    award_or_idv,
    award_type,
    award_type_description,
    award_status,
    total_actions,
    number_of_actions,
    award_amount,
    total_contract_value,
    base_and_exercised_options_value,
    award_date,
    date_signed,
    reveal_date,
    solicitation_date,
    period_of_performance_start_date,
    current_completion_date,
    award_ultimate_completion_date,
    award_fiscal_year,
    contract_fiscal_year,
    naics_code,
    naics_description,
    product_service_code,
    product_service_description,
    product_or_service_type,
    description_of_requirement,
    business_type_description,
    socio_economic_indicator,
    extent_competed_code,
    extent_competed_name,
    set_aside_code,
    set_aside_name,
    contracting_department_code,
    contracting_department_name,
    contracting_agency_code,
    contracting_agency_name,
    contracting_office_code,
    contracting_office_name,
    funding_department_code,
    funding_department_name,
    funding_agency_code,
    funding_agency_name,
    funding_office_code,
    funding_office_name,
    place_of_performance_city,
    place_of_performance_state_code,
    place_of_performance_state_name,
    place_of_performance_country_code,
    place_of_performance_country_name,
    place_of_performance_zip,
    COALESCE(extra_attributes, '{}'::jsonb)
  FROM distinct_awards
  ON CONFLICT (award_key) DO UPDATE
    SET ingest_file_id = COALESCE(EXCLUDED.ingest_file_id, award_transactions.ingest_file_id),
        raw_award_row_id = COALESCE(EXCLUDED.raw_award_row_id, award_transactions.raw_award_row_id),
        vendor_id = EXCLUDED.vendor_id,
        contract_id = COALESCE(NULLIF(EXCLUDED.contract_id, ''), award_transactions.contract_id),
        acquisition_id = COALESCE(NULLIF(EXCLUDED.acquisition_id, ''), award_transactions.acquisition_id),
        source_vendor_info_id = COALESCE(NULLIF(EXCLUDED.source_vendor_info_id, ''), award_transactions.source_vendor_info_id),
        source_vendor_history_id = COALESCE(NULLIF(EXCLUDED.source_vendor_history_id, ''), award_transactions.source_vendor_history_id),
        piid = COALESCE(NULLIF(EXCLUDED.piid, ''), award_transactions.piid),
        reference_piid = COALESCE(NULLIF(EXCLUDED.reference_piid, ''), award_transactions.reference_piid),
        contract_number = COALESCE(NULLIF(EXCLUDED.contract_number, ''), award_transactions.contract_number),
        modification_number = COALESCE(NULLIF(EXCLUDED.modification_number, ''), award_transactions.modification_number),
        reference_modification_number = COALESCE(NULLIF(EXCLUDED.reference_modification_number, ''), award_transactions.reference_modification_number),
        transaction_number = COALESCE(NULLIF(EXCLUDED.transaction_number, ''), award_transactions.transaction_number),
        award_or_idv = COALESCE(NULLIF(EXCLUDED.award_or_idv, ''), award_transactions.award_or_idv),
        award_type = COALESCE(NULLIF(EXCLUDED.award_type, ''), award_transactions.award_type),
        award_type_description = COALESCE(NULLIF(EXCLUDED.award_type_description, ''), award_transactions.award_type_description),
        award_status = COALESCE(NULLIF(EXCLUDED.award_status, ''), award_transactions.award_status),
        total_actions = COALESCE(EXCLUDED.total_actions, award_transactions.total_actions),
        number_of_actions = COALESCE(EXCLUDED.number_of_actions, award_transactions.number_of_actions),
        award_amount = COALESCE(EXCLUDED.award_amount, award_transactions.award_amount),
        total_contract_value = COALESCE(EXCLUDED.total_contract_value, award_transactions.total_contract_value),
        base_and_exercised_options_value = COALESCE(EXCLUDED.base_and_exercised_options_value, award_transactions.base_and_exercised_options_value),
        award_date = COALESCE(EXCLUDED.award_date, award_transactions.award_date),
        date_signed = COALESCE(EXCLUDED.date_signed, award_transactions.date_signed),
        reveal_date = COALESCE(EXCLUDED.reveal_date, award_transactions.reveal_date),
        solicitation_date = COALESCE(EXCLUDED.solicitation_date, award_transactions.solicitation_date),
        period_of_performance_start_date = COALESCE(EXCLUDED.period_of_performance_start_date, award_transactions.period_of_performance_start_date),
        current_completion_date = COALESCE(EXCLUDED.current_completion_date, award_transactions.current_completion_date),
        award_ultimate_completion_date = COALESCE(EXCLUDED.award_ultimate_completion_date, award_transactions.award_ultimate_completion_date),
        award_fiscal_year = COALESCE(EXCLUDED.award_fiscal_year, award_transactions.award_fiscal_year),
        contract_fiscal_year = COALESCE(EXCLUDED.contract_fiscal_year, award_transactions.contract_fiscal_year),
        naics_code = COALESCE(NULLIF(EXCLUDED.naics_code, ''), award_transactions.naics_code),
        naics_description = COALESCE(NULLIF(EXCLUDED.naics_description, ''), award_transactions.naics_description),
        product_service_code = COALESCE(NULLIF(EXCLUDED.product_service_code, ''), award_transactions.product_service_code),
        product_service_description = COALESCE(NULLIF(EXCLUDED.product_service_description, ''), award_transactions.product_service_description),
        product_or_service_type = COALESCE(NULLIF(EXCLUDED.product_or_service_type, ''), award_transactions.product_or_service_type),
        description_of_requirement = COALESCE(NULLIF(EXCLUDED.description_of_requirement, ''), award_transactions.description_of_requirement),
        business_type_description = COALESCE(NULLIF(EXCLUDED.business_type_description, ''), award_transactions.business_type_description),
        socio_economic_indicator = COALESCE(NULLIF(EXCLUDED.socio_economic_indicator, ''), award_transactions.socio_economic_indicator),
        extent_competed_code = COALESCE(NULLIF(EXCLUDED.extent_competed_code, ''), award_transactions.extent_competed_code),
        extent_competed_name = COALESCE(NULLIF(EXCLUDED.extent_competed_name, ''), award_transactions.extent_competed_name),
        set_aside_code = COALESCE(NULLIF(EXCLUDED.set_aside_code, ''), award_transactions.set_aside_code),
        set_aside_name = COALESCE(NULLIF(EXCLUDED.set_aside_name, ''), award_transactions.set_aside_name),
        contracting_department_code = COALESCE(NULLIF(EXCLUDED.contracting_department_code, ''), award_transactions.contracting_department_code),
        contracting_department_name = COALESCE(NULLIF(EXCLUDED.contracting_department_name, ''), award_transactions.contracting_department_name),
        contracting_agency_code = COALESCE(NULLIF(EXCLUDED.contracting_agency_code, ''), award_transactions.contracting_agency_code),
        contracting_agency_name = COALESCE(NULLIF(EXCLUDED.contracting_agency_name, ''), award_transactions.contracting_agency_name),
        contracting_office_code = COALESCE(NULLIF(EXCLUDED.contracting_office_code, ''), award_transactions.contracting_office_code),
        contracting_office_name = COALESCE(NULLIF(EXCLUDED.contracting_office_name, ''), award_transactions.contracting_office_name),
        funding_department_code = COALESCE(NULLIF(EXCLUDED.funding_department_code, ''), award_transactions.funding_department_code),
        funding_department_name = COALESCE(NULLIF(EXCLUDED.funding_department_name, ''), award_transactions.funding_department_name),
        funding_agency_code = COALESCE(NULLIF(EXCLUDED.funding_agency_code, ''), award_transactions.funding_agency_code),
        funding_agency_name = COALESCE(NULLIF(EXCLUDED.funding_agency_name, ''), award_transactions.funding_agency_name),
        funding_office_code = COALESCE(NULLIF(EXCLUDED.funding_office_code, ''), award_transactions.funding_office_code),
        funding_office_name = COALESCE(NULLIF(EXCLUDED.funding_office_name, ''), award_transactions.funding_office_name),
        place_of_performance_city = COALESCE(NULLIF(EXCLUDED.place_of_performance_city, ''), award_transactions.place_of_performance_city),
        place_of_performance_state_code = COALESCE(NULLIF(EXCLUDED.place_of_performance_state_code, ''), award_transactions.place_of_performance_state_code),
        place_of_performance_state_name = COALESCE(NULLIF(EXCLUDED.place_of_performance_state_name, ''), award_transactions.place_of_performance_state_name),
        place_of_performance_country_code = COALESCE(NULLIF(EXCLUDED.place_of_performance_country_code, ''), award_transactions.place_of_performance_country_code),
        place_of_performance_country_name = COALESCE(NULLIF(EXCLUDED.place_of_performance_country_name, ''), award_transactions.place_of_performance_country_name),
        place_of_performance_zip = COALESCE(NULLIF(EXCLUDED.place_of_performance_zip, ''), award_transactions.place_of_performance_zip),
        extra_attributes = award_transactions.extra_attributes || EXCLUDED.extra_attributes
  RETURNING award_key
)
SELECT
  (SELECT COUNT(*) FROM valid_rows) AS processed_count,
  (SELECT COUNT(*) FROM resolved_raw_rows WHERE raw_award_row_id IS NOT NULL) AS raw_rows_linked,
  (SELECT COUNT(*) FROM upsert_awards) AS awards_upserted;
`;

async function createOrReuseIngestFile(client, {
  fileName,
  filePath = null,
  fileSizeBytes = null,
  rowCount = null,
  headerHash = null,
  metadata = {},
}) {
  const { periodStart, periodEnd } = parseCsvPeriod(fileName);
  const result = await client.query(
    `INSERT INTO ingest_files (
       file_name,
       file_path,
       period_start,
       period_end,
       file_size_bytes,
       row_count,
       header_hash,
       load_status,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8::jsonb)
     ON CONFLICT (file_name) DO UPDATE
       SET file_path = COALESCE(EXCLUDED.file_path, ingest_files.file_path),
           period_start = EXCLUDED.period_start,
           period_end = EXCLUDED.period_end,
           file_size_bytes = EXCLUDED.file_size_bytes,
           row_count = EXCLUDED.row_count,
           header_hash = EXCLUDED.header_hash,
           load_status = 'pending',
           loaded_at = NULL,
           metadata = ingest_files.metadata || EXCLUDED.metadata
     RETURNING ingest_file_id`,
    [
      fileName,
      filePath,
      periodStart,
      periodEnd,
      fileSizeBytes,
      rowCount,
      headerHash,
      JSON.stringify(metadata),
    ],
  );

  return result.rows[0].ingest_file_id;
}

async function markIngestFile(client, ingestFileId, rowCount, status, metadata = {}) {
  await client.query(
    `UPDATE ingest_files
        SET row_count = COALESCE($2, row_count),
            load_status = $3,
            loaded_at = CASE WHEN $3 = 'loaded' THEN NOW() ELSE NULL END,
            metadata = metadata || $4::jsonb
      WHERE ingest_file_id = $1`,
    [ingestFileId, rowCount, status, JSON.stringify(metadata)],
  );
}

async function insertRawAwardRow(client, ingestFileId, sourceRowNumber, rawRow, mapped) {
  const sourceRowHash = hashObject(rawRow);
  const payload = JSON.stringify(rawRow);

  const insertResult = await client.query(
    `INSERT INTO raw_award_rows (
       ingest_file_id,
       source_row_number,
       source_row_hash,
       contract_id,
       acquisition_id,
       vendor_uei,
       vendor_name,
       award_date,
       reveal_date,
       payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING raw_award_row_id`,
    [
      ingestFileId,
      sourceRowNumber,
      sourceRowHash,
      mapped.award.contractId,
      mapped.award.acquisitionId,
      mapped.vendor.uei,
      mapped.vendor.vendorName,
      mapped.award.awardDate,
      mapped.award.revealDate,
      payload,
    ],
  );

  if (insertResult.rows[0]) {
    return insertResult.rows[0].raw_award_row_id;
  }

  const existing = await client.query(
    'SELECT raw_award_row_id FROM raw_award_rows WHERE source_row_hash = $1 LIMIT 1',
    [sourceRowHash],
  );

  return existing.rows[0]?.raw_award_row_id || null;
}

function mergeJson(existingJson, patchObject) {
  return compactObject({
    ...existingJson,
    ...patchObject,
  });
}

async function upsertVendor(client, vendor, vendorCache) {
  const cacheKey = [vendor.cageCode || '', vendor.uei || '', vendor.vendorKey].join('|');
  if (vendorCache.has(cacheKey)) {
    return vendorCache.get(cacheKey);
  }

  const existingResult = await client.query(
    `SELECT vendor_id, vendor_key, cage_code, uei, raw_vendor
       FROM vendor_entities
      WHERE ($1::varchar IS NOT NULL AND cage_code = $1)
         OR ($2::varchar IS NOT NULL AND uei = $2)
         OR vendor_key = $3
      ORDER BY CASE
        WHEN $1::varchar IS NOT NULL AND cage_code = $1 THEN 0
        WHEN $2::varchar IS NOT NULL AND uei = $2 THEN 1
        ELSE 2
      END
      LIMIT 1`,
    [vendor.cageCode, vendor.uei, vendor.vendorKey],
  );

  const rawVendorPatch = buildRawVendorPatch(vendor);

  if (existingResult.rows[0]) {
    const existing = existingResult.rows[0];
    const nextVendorKey = existing.cage_code || !vendor.cageCode ? existing.vendor_key : vendor.vendorKey;
    const updateResult = await client.query(
      `UPDATE vendor_entities
          SET vendor_key = $2,
              cage_code = COALESCE($3, cage_code),
              uei = COALESCE($4, uei),
              vendor_name = COALESCE(NULLIF($5, ''), vendor_name),
              business_type_description = COALESCE(NULLIF($6, ''), business_type_description),
              socio_economic_indicator = COALESCE(NULLIF($7, ''), socio_economic_indicator),
              parent_company_name = COALESCE(NULLIF($8, ''), parent_company_name),
              parent_uei = COALESCE(NULLIF($9, ''), parent_uei),
              ultimate_uei = COALESCE(NULLIF($10, ''), ultimate_uei),
              ultimate_uei_name = COALESCE(NULLIF($11, ''), ultimate_uei_name),
              vendor_phone_number = COALESCE(NULLIF($12, ''), vendor_phone_number),
              vendor_fax_number = COALESCE(NULLIF($13, ''), vendor_fax_number),
              annual_revenue = COALESCE($14, annual_revenue),
              number_of_employees = COALESCE($15, number_of_employees),
              vendor_registration_date = COALESCE($16, vendor_registration_date),
              vendor_renewal_date = COALESCE($17, vendor_renewal_date),
              city = COALESCE(NULLIF($18, ''), city),
              state_code = COALESCE(NULLIF($19, ''), state_code),
              state_name = COALESCE(NULLIF($20, ''), state_name),
              zip_code = COALESCE(NULLIF($21, ''), zip_code),
              country_code = COALESCE(NULLIF($22, ''), country_code),
              country_name = COALESCE(NULLIF($23, ''), country_name),
              source_vendor_info_id = COALESCE(NULLIF($24, ''), source_vendor_info_id),
              source_vendor_history_id = COALESCE(NULLIF($25, ''), source_vendor_history_id),
              raw_vendor = $26::jsonb
        WHERE vendor_id = $1
        RETURNING vendor_id`,
      [
        existing.vendor_id,
        nextVendorKey,
        vendor.cageCode,
        vendor.uei,
        vendor.vendorName,
        vendor.businessTypeDescription,
        vendor.socioEconomicIndicator,
        vendor.parentCompanyName,
        vendor.parentUei,
        vendor.ultimateUei,
        vendor.ultimateUeiName,
        vendor.vendorPhoneNumber,
        vendor.vendorFaxNumber,
        vendor.annualRevenue,
        vendor.numberOfEmployees,
        vendor.vendorRegistrationDate,
        vendor.vendorRenewalDate,
        vendor.city,
        vendor.stateCode,
        vendor.stateName,
        vendor.zipCode,
        vendor.countryCode,
        vendor.countryName,
        vendor.sourceVendorInfoId,
        vendor.sourceVendorHistoryId,
        JSON.stringify(mergeJson(existing.raw_vendor || {}, rawVendorPatch)),
      ],
    );

    const vendorId = updateResult.rows[0].vendor_id;
    vendorCache.set(cacheKey, vendorId);
    return vendorId;
  }

  const insertResult = await client.query(
    `INSERT INTO vendor_entities (
       vendor_key,
       cage_code,
       uei,
       vendor_name,
       business_type_description,
       socio_economic_indicator,
       parent_company_name,
       parent_uei,
       ultimate_uei,
       ultimate_uei_name,
       vendor_phone_number,
       vendor_fax_number,
       annual_revenue,
       number_of_employees,
       vendor_registration_date,
       vendor_renewal_date,
       city,
       state_code,
       state_name,
       zip_code,
       country_code,
       country_name,
       source_vendor_info_id,
       source_vendor_history_id,
       raw_vendor
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
       $21, $22, $23, $24, $25::jsonb
     )
     RETURNING vendor_id`,
    [
      vendor.vendorKey,
      vendor.cageCode,
      vendor.uei,
      vendor.vendorName,
      vendor.businessTypeDescription,
      vendor.socioEconomicIndicator,
      vendor.parentCompanyName,
      vendor.parentUei,
      vendor.ultimateUei,
      vendor.ultimateUeiName,
      vendor.vendorPhoneNumber,
      vendor.vendorFaxNumber,
      vendor.annualRevenue,
      vendor.numberOfEmployees,
      vendor.vendorRegistrationDate,
      vendor.vendorRenewalDate,
      vendor.city,
      vendor.stateCode,
      vendor.stateName,
      vendor.zipCode,
      vendor.countryCode,
      vendor.countryName,
      vendor.sourceVendorInfoId,
      vendor.sourceVendorHistoryId,
      JSON.stringify(rawVendorPatch),
    ],
  );

  const vendorId = insertResult.rows[0].vendor_id;
  vendorCache.set(cacheKey, vendorId);
  return vendorId;
}

async function upsertCodeTable(client, tableName, code, description) {
  if (!code) {
    return;
  }

  await client.query(
    `INSERT INTO ${tableName} (code, description)
     VALUES ($1, COALESCE($2, 'Unknown'))
     ON CONFLICT (code) DO NOTHING`,
    [code, description],
  );
}

async function upsertAwardTransaction(client, ingestFileId, rawAwardRowId, vendorId, mapped) {
  const award = mapped.award;
  const result = await client.query(
    `INSERT INTO award_transactions (
       award_key,
       ingest_file_id,
       raw_award_row_id,
       vendor_id,
       contract_id,
       acquisition_id,
       source_vendor_info_id,
       source_vendor_history_id,
       piid,
       reference_piid,
       contract_number,
       modification_number,
       reference_modification_number,
       transaction_number,
       award_or_idv,
       award_type,
       award_type_description,
       award_status,
       total_actions,
       number_of_actions,
       award_amount,
       total_contract_value,
       base_and_exercised_options_value,
       award_date,
       date_signed,
       reveal_date,
       solicitation_date,
       period_of_performance_start_date,
       current_completion_date,
       award_ultimate_completion_date,
       award_fiscal_year,
       contract_fiscal_year,
       naics_code,
       naics_description,
       product_service_code,
       product_service_description,
       product_or_service_type,
       description_of_requirement,
       business_type_description,
       socio_economic_indicator,
       extent_competed_code,
       extent_competed_name,
       set_aside_code,
       set_aside_name,
       contracting_department_code,
       contracting_department_name,
       contracting_agency_code,
       contracting_agency_name,
       contracting_office_code,
       contracting_office_name,
       funding_department_code,
       funding_department_name,
       funding_agency_code,
       funding_agency_name,
       funding_office_code,
       funding_office_name,
       place_of_performance_city,
       place_of_performance_state_code,
       place_of_performance_state_name,
       place_of_performance_country_code,
       place_of_performance_country_name,
       place_of_performance_zip,
       extra_attributes
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
       $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
       $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
       $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
       $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
       $61, $62, $63::jsonb
     )
     ON CONFLICT (award_key) DO UPDATE
       SET ingest_file_id = COALESCE(EXCLUDED.ingest_file_id, award_transactions.ingest_file_id),
           raw_award_row_id = COALESCE(EXCLUDED.raw_award_row_id, award_transactions.raw_award_row_id),
           vendor_id = EXCLUDED.vendor_id,
           contract_id = COALESCE(NULLIF(EXCLUDED.contract_id, ''), award_transactions.contract_id),
           acquisition_id = COALESCE(NULLIF(EXCLUDED.acquisition_id, ''), award_transactions.acquisition_id),
           source_vendor_info_id = COALESCE(NULLIF(EXCLUDED.source_vendor_info_id, ''), award_transactions.source_vendor_info_id),
           source_vendor_history_id = COALESCE(NULLIF(EXCLUDED.source_vendor_history_id, ''), award_transactions.source_vendor_history_id),
           piid = COALESCE(NULLIF(EXCLUDED.piid, ''), award_transactions.piid),
           reference_piid = COALESCE(NULLIF(EXCLUDED.reference_piid, ''), award_transactions.reference_piid),
           contract_number = COALESCE(NULLIF(EXCLUDED.contract_number, ''), award_transactions.contract_number),
           modification_number = COALESCE(NULLIF(EXCLUDED.modification_number, ''), award_transactions.modification_number),
           reference_modification_number = COALESCE(NULLIF(EXCLUDED.reference_modification_number, ''), award_transactions.reference_modification_number),
           transaction_number = COALESCE(NULLIF(EXCLUDED.transaction_number, ''), award_transactions.transaction_number),
           award_or_idv = COALESCE(NULLIF(EXCLUDED.award_or_idv, ''), award_transactions.award_or_idv),
           award_type = COALESCE(NULLIF(EXCLUDED.award_type, ''), award_transactions.award_type),
           award_type_description = COALESCE(NULLIF(EXCLUDED.award_type_description, ''), award_transactions.award_type_description),
           award_status = COALESCE(NULLIF(EXCLUDED.award_status, ''), award_transactions.award_status),
           total_actions = COALESCE(EXCLUDED.total_actions, award_transactions.total_actions),
           number_of_actions = COALESCE(EXCLUDED.number_of_actions, award_transactions.number_of_actions),
           award_amount = COALESCE(EXCLUDED.award_amount, award_transactions.award_amount),
           total_contract_value = COALESCE(EXCLUDED.total_contract_value, award_transactions.total_contract_value),
           base_and_exercised_options_value = COALESCE(EXCLUDED.base_and_exercised_options_value, award_transactions.base_and_exercised_options_value),
           award_date = COALESCE(EXCLUDED.award_date, award_transactions.award_date),
           date_signed = COALESCE(EXCLUDED.date_signed, award_transactions.date_signed),
           reveal_date = COALESCE(EXCLUDED.reveal_date, award_transactions.reveal_date),
           solicitation_date = COALESCE(EXCLUDED.solicitation_date, award_transactions.solicitation_date),
           period_of_performance_start_date = COALESCE(EXCLUDED.period_of_performance_start_date, award_transactions.period_of_performance_start_date),
           current_completion_date = COALESCE(EXCLUDED.current_completion_date, award_transactions.current_completion_date),
           award_ultimate_completion_date = COALESCE(EXCLUDED.award_ultimate_completion_date, award_transactions.award_ultimate_completion_date),
           award_fiscal_year = COALESCE(EXCLUDED.award_fiscal_year, award_transactions.award_fiscal_year),
           contract_fiscal_year = COALESCE(EXCLUDED.contract_fiscal_year, award_transactions.contract_fiscal_year),
           naics_code = COALESCE(NULLIF(EXCLUDED.naics_code, ''), award_transactions.naics_code),
           naics_description = COALESCE(NULLIF(EXCLUDED.naics_description, ''), award_transactions.naics_description),
           product_service_code = COALESCE(NULLIF(EXCLUDED.product_service_code, ''), award_transactions.product_service_code),
           product_service_description = COALESCE(NULLIF(EXCLUDED.product_service_description, ''), award_transactions.product_service_description),
           product_or_service_type = COALESCE(NULLIF(EXCLUDED.product_or_service_type, ''), award_transactions.product_or_service_type),
           description_of_requirement = COALESCE(NULLIF(EXCLUDED.description_of_requirement, ''), award_transactions.description_of_requirement),
           business_type_description = COALESCE(NULLIF(EXCLUDED.business_type_description, ''), award_transactions.business_type_description),
           socio_economic_indicator = COALESCE(NULLIF(EXCLUDED.socio_economic_indicator, ''), award_transactions.socio_economic_indicator),
           extent_competed_code = COALESCE(NULLIF(EXCLUDED.extent_competed_code, ''), award_transactions.extent_competed_code),
           extent_competed_name = COALESCE(NULLIF(EXCLUDED.extent_competed_name, ''), award_transactions.extent_competed_name),
           set_aside_code = COALESCE(NULLIF(EXCLUDED.set_aside_code, ''), award_transactions.set_aside_code),
           set_aside_name = COALESCE(NULLIF(EXCLUDED.set_aside_name, ''), award_transactions.set_aside_name),
           contracting_department_code = COALESCE(NULLIF(EXCLUDED.contracting_department_code, ''), award_transactions.contracting_department_code),
           contracting_department_name = COALESCE(NULLIF(EXCLUDED.contracting_department_name, ''), award_transactions.contracting_department_name),
           contracting_agency_code = COALESCE(NULLIF(EXCLUDED.contracting_agency_code, ''), award_transactions.contracting_agency_code),
           contracting_agency_name = COALESCE(NULLIF(EXCLUDED.contracting_agency_name, ''), award_transactions.contracting_agency_name),
           contracting_office_code = COALESCE(NULLIF(EXCLUDED.contracting_office_code, ''), award_transactions.contracting_office_code),
           contracting_office_name = COALESCE(NULLIF(EXCLUDED.contracting_office_name, ''), award_transactions.contracting_office_name),
           funding_department_code = COALESCE(NULLIF(EXCLUDED.funding_department_code, ''), award_transactions.funding_department_code),
           funding_department_name = COALESCE(NULLIF(EXCLUDED.funding_department_name, ''), award_transactions.funding_department_name),
           funding_agency_code = COALESCE(NULLIF(EXCLUDED.funding_agency_code, ''), award_transactions.funding_agency_code),
           funding_agency_name = COALESCE(NULLIF(EXCLUDED.funding_agency_name, ''), award_transactions.funding_agency_name),
           funding_office_code = COALESCE(NULLIF(EXCLUDED.funding_office_code, ''), award_transactions.funding_office_code),
           funding_office_name = COALESCE(NULLIF(EXCLUDED.funding_office_name, ''), award_transactions.funding_office_name),
           place_of_performance_city = COALESCE(NULLIF(EXCLUDED.place_of_performance_city, ''), award_transactions.place_of_performance_city),
           place_of_performance_state_code = COALESCE(NULLIF(EXCLUDED.place_of_performance_state_code, ''), award_transactions.place_of_performance_state_code),
           place_of_performance_state_name = COALESCE(NULLIF(EXCLUDED.place_of_performance_state_name, ''), award_transactions.place_of_performance_state_name),
           place_of_performance_country_code = COALESCE(NULLIF(EXCLUDED.place_of_performance_country_code, ''), award_transactions.place_of_performance_country_code),
           place_of_performance_country_name = COALESCE(NULLIF(EXCLUDED.place_of_performance_country_name, ''), award_transactions.place_of_performance_country_name),
           place_of_performance_zip = COALESCE(NULLIF(EXCLUDED.place_of_performance_zip, ''), award_transactions.place_of_performance_zip),
           extra_attributes = award_transactions.extra_attributes || EXCLUDED.extra_attributes
     RETURNING award_tx_id`,
    [
      award.awardKey,
      ingestFileId,
      rawAwardRowId,
      vendorId,
      award.contractId,
      award.acquisitionId,
      award.sourceVendorInfoId,
      award.sourceVendorHistoryId,
      award.piid,
      award.referencePiid,
      award.contractNumber,
      award.modificationNumber,
      award.referenceModificationNumber,
      award.transactionNumber,
      award.awardOrIdv,
      award.awardType,
      award.awardTypeDescription,
      award.awardStatus,
      award.totalActions,
      award.numberOfActions,
      award.awardAmount,
      award.totalContractValue,
      award.baseAndExercisedOptionsValue,
      award.awardDate,
      award.dateSigned,
      award.revealDate,
      award.solicitationDate,
      award.periodOfPerformanceStartDate,
      award.currentCompletionDate,
      award.awardUltimateCompletionDate,
      award.awardFiscalYear,
      award.contractFiscalYear,
      award.naicsCode,
      award.naicsDescription,
      award.productServiceCode,
      award.productServiceDescription,
      award.productOrServiceType,
      award.descriptionOfRequirement,
      award.businessTypeDescription,
      award.socioEconomicIndicator,
      award.extentCompetedCode,
      award.extentCompetedName,
      award.setAsideCode,
      award.setAsideName,
      award.contractingDepartmentCode,
      award.contractingDepartmentName,
      award.contractingAgencyCode,
      award.contractingAgencyName,
      award.contractingOfficeCode,
      award.contractingOfficeName,
      award.fundingDepartmentCode,
      award.fundingDepartmentName,
      award.fundingAgencyCode,
      award.fundingAgencyName,
      award.fundingOfficeCode,
      award.fundingOfficeName,
      award.placeOfPerformanceCity,
      award.placeOfPerformanceStateCode,
      award.placeOfPerformanceStateName,
      award.placeOfPerformanceCountryCode,
      award.placeOfPerformanceCountryName,
      award.placeOfPerformanceZip,
      JSON.stringify(award.extraAttributes),
    ],
  );

  return result.rows[0].award_tx_id;
}

function createIngestState({ ingestFileId, total = 0 } = {}) {
  return {
    ingestFileId,
    total,
    inserted: 0,
    skipped: 0,
    rawRowsLinked: 0,
    errors: [],
    vendorCache: new Map(),
    knownNaics: new Set(),
    knownProductServiceCodes: new Set(),
  };
}

async function beginIngestFile(client, {
  fileName,
  filePath = null,
  fileSizeBytes = null,
  rowCount = null,
  headers = null,
  metadata = {},
}) {
  const headerHash = Array.isArray(headers) && headers.length > 0 ? hashObject(headers) : null;
  return createOrReuseIngestFile(client, {
    fileName,
    filePath,
    fileSizeBytes,
    rowCount,
    headerHash,
    metadata,
  });
}

async function ingestAwardRowsBulk(client, state, { ingestFileId, rows, startRowNumber = 1 }) {
  const preparedRows = [];

  rows.forEach((rawRow, index) => {
    const prepared = prepareBulkRow(rawRow, startRowNumber + index);
    if (!prepared.valid) {
      state.skipped++;
      state.errors.push(prepared.error);
      return;
    }

    preparedRows.push(prepared.row);
  });

  if (preparedRows.length === 0) {
    return;
  }

  const result = await client.query(BULK_INGEST_SQL, [JSON.stringify(preparedRows), ingestFileId]);
  const summary = result.rows[0] || {};

  state.inserted += Number(summary.processed_count || 0);
  state.rawRowsLinked += Number(summary.raw_rows_linked || 0);
}

async function ingestAwardRowsRowByRow(client, state, { ingestFileId, rows, startRowNumber = 1 }) {
  for (const [index, rawRow] of rows.entries()) {
    const mapped = mapUploadedRow(rawRow);

    if (!mapped.vendor.vendorKey || !mapped.award.awardKey) {
      state.skipped++;
      state.errors.push({ rowNumber: startRowNumber + index, reason: 'Missing vendor or award identity' });
      continue;
    }

    await client.query('SAVEPOINT ingest_row');

    try {
      const rawAwardRowId = await insertRawAwardRow(client, ingestFileId, startRowNumber + index, rawRow, mapped);
      if (rawAwardRowId) {
        state.rawRowsLinked++;
      }

      const vendorId = await upsertVendor(client, mapped.vendor, state.vendorCache);

      if (mapped.award.naicsCode && !state.knownNaics.has(mapped.award.naicsCode)) {
        await upsertCodeTable(client, 'naics_codes', mapped.award.naicsCode, mapped.award.naicsDescription);
        state.knownNaics.add(mapped.award.naicsCode);
      }

      if (mapped.award.productServiceCode && !state.knownProductServiceCodes.has(mapped.award.productServiceCode)) {
        await upsertCodeTable(
          client,
          'product_service_codes',
          mapped.award.productServiceCode,
          mapped.award.productServiceDescription || mapped.award.productServiceType || 'Unknown',
        );
        state.knownProductServiceCodes.add(mapped.award.productServiceCode);
      }

      await upsertAwardTransaction(client, ingestFileId, rawAwardRowId, vendorId, mapped);

      state.inserted++;
      await client.query('RELEASE SAVEPOINT ingest_row');
    } catch (rowError) {
      await client.query('ROLLBACK TO SAVEPOINT ingest_row');
      await client.query('RELEASE SAVEPOINT ingest_row');
      state.skipped++;
      state.errors.push({ rowNumber: startRowNumber + index, reason: rowError.message });
    }
  }
}

async function ingestAwardRows(client, state, { ingestFileId, rows, startRowNumber = 1 }) {
  if (FORCE_ROW_BY_ROW_IMPORT) {
    await ingestAwardRowsRowByRow(client, state, {
      ingestFileId,
      rows,
      startRowNumber,
    });
    return;
  }

  await client.query('SAVEPOINT ingest_batch_fast_path');

  try {
    await ingestAwardRowsBulk(client, state, {
      ingestFileId,
      rows,
      startRowNumber,
    });
    await client.query('RELEASE SAVEPOINT ingest_batch_fast_path');
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT ingest_batch_fast_path');
    await client.query('RELEASE SAVEPOINT ingest_batch_fast_path');

    logger.warn('bulk ingest batch failed; falling back to row-by-row import', {
      ingestFileId,
      startRowNumber,
      rowCount: rows.length,
      error: error.message,
    });

    await ingestAwardRowsRowByRow(client, state, {
      ingestFileId,
      rows,
      startRowNumber,
    });
  }
}

async function finalizeIngestFile(client, state, { ingestFileId, rowCount, status = 'loaded', metadata = {} }) {
  await markIngestFile(client, ingestFileId, rowCount, status, {
    inserted_rows: state.inserted,
    skipped_rows: state.skipped,
    raw_rows_linked: state.rawRowsLinked,
    ...metadata,
  });
}

async function ingestUploadedAwards(client, { fileName, filePath = null, fileSizeBytes, rows, metadata = {} }) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const ingestFileId = await beginIngestFile(client, {
    fileName,
    filePath,
    fileSizeBytes,
    rowCount: rows.length,
    headers,
    metadata: { source: 'api_upload', ...metadata },
  });
  const state = createIngestState({ ingestFileId, total: rows.length });

  await ingestAwardRows(client, state, {
    ingestFileId,
    rows,
    startRowNumber: 1,
  });

  await finalizeIngestFile(client, state, {
    ingestFileId,
    rowCount: rows.length,
    status: 'loaded',
  });

  await refreshAnalyticsCaches(client);

  return state;
}

module.exports = {
  beginIngestFile,
  createIngestState,
  finalizeIngestFile,
  ingestAwardRows,
  ingestUploadedAwards,
  mapUploadedRow,
  markIngestFile,
  parseCsvPeriod,
};
