import KPIBanner from '../components/KPIBanner';
import AwardTypeBreakdown from '../components/AwardTypeBreakdown';
import TopNaics from '../components/TopNaics';
import SpendingByState from '../components/SpendingByState';
import TopEarners from '../components/TopEarners';
import CompanyGraph from '../components/CompanyGraph';
import AwardsTable from '../components/AwardsTable';

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI banner */}
      <KPIBanner />

      {/* Top earners — full width, just under KPIs */}
      <TopEarners />

      {/* 3 charts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AwardTypeBreakdown />
        <TopNaics />
        <SpendingByState />
      </div>

      {/* Company graph — full width */}
      <CompanyGraph />

      {/* Awards table */}
      <AwardsTable cageCode={null} />
    </div>
  );
}
