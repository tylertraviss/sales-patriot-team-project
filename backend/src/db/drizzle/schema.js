const { sql } = require('drizzle-orm');
const {
  bigint,
  bigserial,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} = require('drizzle-orm/pg-core');

const uuidDefault = () => sql`uuid_generate_v4()`;
const emptyJsonb = () => sql`'{}'::jsonb`;

const timestamptz = (name) => timestamp(name, { withTimezone: true });

const ingestFiles = pgTable('ingest_files', {
  ingestFileId: uuid('ingest_file_id').primaryKey().default(uuidDefault()),
  fileName: text('file_name').notNull().unique(),
  filePath: text('file_path'),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  rowCount: bigint('row_count', { mode: 'number' }),
  headerHash: text('header_hash'),
  loadStatus: text('load_status').notNull().default('pending'),
  loadedAt: timestamptz('loaded_at'),
  metadata: jsonb('metadata').notNull().default(emptyJsonb()),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

const rawAwardRows = pgTable('raw_award_rows', {
  rawAwardRowId: bigserial('raw_award_row_id', { mode: 'number' }).primaryKey(),
  ingestFileId: uuid('ingest_file_id')
    .notNull()
    .references(() => ingestFiles.ingestFileId, { onDelete: 'cascade' }),
  sourceRowNumber: bigint('source_row_number', { mode: 'number' }).notNull(),
  sourceRowHash: text('source_row_hash'),
  contractId: text('contract_id'),
  acquisitionId: text('acquisition_id'),
  vendorUei: text('vendor_uei'),
  vendorName: text('vendor_name'),
  awardDate: date('award_date'),
  revealDate: date('reveal_date'),
  payload: jsonb('payload').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

const vendorEntities = pgTable('vendor_entities', {
  vendorId: uuid('vendor_id').primaryKey().default(uuidDefault()),
  vendorKey: text('vendor_key').notNull().unique(),
  cageCode: varchar('cage_code', { length: 10 }),
  uei: varchar('uei', { length: 20 }),
  vendorName: varchar('vendor_name', { length: 500 }).notNull(),
  businessTypeDescription: text('business_type_description'),
  socioEconomicIndicator: text('socio_economic_indicator'),
  parentCompanyName: varchar('parent_company_name', { length: 500 }),
  parentUei: varchar('parent_uei', { length: 20 }),
  ultimateUei: varchar('ultimate_uei', { length: 20 }),
  ultimateUeiName: varchar('ultimate_uei_name', { length: 500 }),
  vendorPhoneNumber: text('vendor_phone_number'),
  vendorFaxNumber: text('vendor_fax_number'),
  annualRevenue: numeric('annual_revenue', { precision: 18, scale: 2 }),
  numberOfEmployees: integer('number_of_employees'),
  vendorRegistrationDate: date('vendor_registration_date'),
  vendorRenewalDate: date('vendor_renewal_date'),
  city: varchar('city', { length: 200 }),
  stateCode: varchar('state_code', { length: 10 }),
  stateName: varchar('state_name', { length: 100 }),
  zipCode: varchar('zip_code', { length: 20 }),
  countryCode: varchar('country_code', { length: 10 }),
  countryName: varchar('country_name', { length: 100 }),
  sourceVendorInfoId: text('source_vendor_info_id'),
  sourceVendorHistoryId: text('source_vendor_history_id'),
  rawVendor: jsonb('raw_vendor').notNull().default(emptyJsonb()),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

const naicsCodes = pgTable('naics_codes', {
  code: varchar('code', { length: 10 }).primaryKey(),
  description: text('description').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

const productServiceCodes = pgTable('product_service_codes', {
  code: varchar('code', { length: 10 }).primaryKey(),
  description: text('description').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

const awardTransactions = pgTable('award_transactions', {
  awardTxId: uuid('award_tx_id').primaryKey().default(uuidDefault()),
  awardKey: text('award_key').notNull().unique(),
  ingestFileId: uuid('ingest_file_id').references(() => ingestFiles.ingestFileId, { onDelete: 'set null' }),
  rawAwardRowId: bigint('raw_award_row_id', { mode: 'number' }).references(() => rawAwardRows.rawAwardRowId, {
    onDelete: 'set null',
  }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendorEntities.vendorId, { onDelete: 'restrict' }),
  contractId: text('contract_id'),
  acquisitionId: text('acquisition_id'),
  sourceVendorInfoId: text('source_vendor_info_id'),
  sourceVendorHistoryId: text('source_vendor_history_id'),
  piid: text('piid'),
  referencePiid: text('reference_piid'),
  contractNumber: text('contract_number'),
  modificationNumber: text('modification_number'),
  referenceModificationNumber: text('reference_modification_number'),
  transactionNumber: text('transaction_number'),
  awardOrIdv: text('award_or_idv'),
  awardType: text('award_type'),
  awardTypeDescription: text('award_type_description'),
  awardStatus: text('award_status'),
  totalActions: integer('total_actions'),
  numberOfActions: integer('number_of_actions'),
  awardAmount: numeric('award_amount', { precision: 18, scale: 2 }),
  totalContractValue: numeric('total_contract_value', { precision: 18, scale: 2 }),
  baseAndExercisedOptionsValue: numeric('base_and_exercised_options_value', { precision: 18, scale: 2 }),
  awardDate: date('award_date'),
  dateSigned: date('date_signed'),
  revealDate: date('reveal_date'),
  solicitationDate: date('solicitation_date'),
  periodOfPerformanceStartDate: date('period_of_performance_start_date'),
  currentCompletionDate: date('current_completion_date'),
  awardUltimateCompletionDate: date('award_ultimate_completion_date'),
  awardFiscalYear: integer('award_fiscal_year'),
  contractFiscalYear: integer('contract_fiscal_year'),
  naicsCode: varchar('naics_code', { length: 10 }).references(() => naicsCodes.code, { onDelete: 'set null' }),
  naicsDescription: text('naics_description'),
  productServiceCode: varchar('product_service_code', { length: 10 }).references(() => productServiceCodes.code, {
    onDelete: 'set null',
  }),
  productServiceDescription: text('product_service_description'),
  productOrServiceType: text('product_or_service_type'),
  descriptionOfRequirement: text('description_of_requirement'),
  businessTypeDescription: text('business_type_description'),
  socioEconomicIndicator: text('socio_economic_indicator'),
  extentCompetedCode: text('extent_competed_code'),
  extentCompetedName: text('extent_competed_name'),
  setAsideCode: text('set_aside_code'),
  setAsideName: text('set_aside_name'),
  contractingDepartmentCode: text('contracting_department_code'),
  contractingDepartmentName: text('contracting_department_name'),
  contractingAgencyCode: text('contracting_agency_code'),
  contractingAgencyName: text('contracting_agency_name'),
  contractingOfficeCode: text('contracting_office_code'),
  contractingOfficeName: text('contracting_office_name'),
  fundingDepartmentCode: text('funding_department_code'),
  fundingDepartmentName: text('funding_department_name'),
  fundingAgencyCode: text('funding_agency_code'),
  fundingAgencyName: text('funding_agency_name'),
  fundingOfficeCode: text('funding_office_code'),
  fundingOfficeName: text('funding_office_name'),
  placeOfPerformanceCity: text('place_of_performance_city'),
  placeOfPerformanceStateCode: text('place_of_performance_state_code'),
  placeOfPerformanceStateName: text('place_of_performance_state_name'),
  placeOfPerformanceCountryCode: text('place_of_performance_country_code'),
  placeOfPerformanceCountryName: text('place_of_performance_country_name'),
  placeOfPerformanceZip: text('place_of_performance_zip'),
  extraAttributes: jsonb('extra_attributes').notNull().default(emptyJsonb()),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

const companies = pgTable('companies', {
  cageCode: varchar('cage_code', { length: 10 }).primaryKey(),
  companyName: varchar('company_name', { length: 500 }).notNull(),
  vendorId: uuid('vendor_id').references(() => vendorEntities.vendorId, { onDelete: 'set null' }),
  uei: varchar('uei', { length: 20 }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

const awards = pgTable('awards', {
  id: uuid('id').primaryKey().default(uuidDefault()),
  awardTxId: uuid('award_tx_id').references(() => awardTransactions.awardTxId, { onDelete: 'set null' }),
  cageCode: varchar('cage_code', { length: 10 })
    .notNull()
    .references(() => companies.cageCode, { onDelete: 'cascade' }),
  awardAmount: numeric('award_amount', { precision: 18, scale: 2 }),
  awardDate: date('award_date'),
  contractNumber: varchar('contract_number', { length: 100 }),
  description: text('description'),
  dlaOffice: varchar('dla_office', { length: 200 }),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

module.exports = {
  awards,
  awardTransactions,
  companies,
  ingestFiles,
  naicsCodes,
  productServiceCodes,
  rawAwardRows,
  vendorEntities,
};
