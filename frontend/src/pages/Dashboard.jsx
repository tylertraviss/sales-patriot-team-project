import { useState } from 'react';
import AwardsTable from '../components/AwardsTable';
import CompanySearch from '../components/CompanySearch';
import TopEarners from '../components/TopEarners';
import SpendingByState from '../components/SpendingByState';
import TopNaics from '../components/TopNaics';
import CompetedOverTime from '../components/CompetedOverTime';
import AwardTypeBreakdown from '../components/AwardTypeBreakdown';
import CompanyGraph from '../components/CompanyGraph';

export default function Dashboard() {
  const [selectedCompany, setSelectedCompany] = useState(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">DLA Awards Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse and filter Defense Logistics Agency contract awards by company or CAGE code.
        </p>
      </div>

      {/* Company search filter */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Filter by Company / CAGE Code</label>
        <CompanySearch
          onSelect={(company) => setSelectedCompany(company)}
          placeholder="Search company name or CAGE code…"
        />
        {selectedCompany && (
          <p className="text-sm text-gray-600">
            Showing awards for{' '}
            <span className="font-semibold text-gray-900">{selectedCompany.company_name}</span>
            {' '}(CAGE: {selectedCompany.cage_code})
          </p>
        )}
      </div>

      {/* Top earners insight card */}
      <TopEarners />

      {/* 2-column chart grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SpendingByState />
        <AwardTypeBreakdown />
        <TopNaics />
        <CompetedOverTime />
      </div>

      {/* Company relationship graph */}
      <CompanyGraph />

      {/* Awards table */}
      <AwardsTable cageCode={selectedCompany?.cage_code ?? null} />
    </div>
  );
}
