import KPIBanner from '../components/KPIBanner';
import TopNaics from '../components/TopNaics';
import SpendingByState from '../components/SpendingByState';
import TopEarners from '../components/TopEarners';

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI banner */}
      <KPIBanner />

      {/* Top earners — full width, just under KPIs */}
      <TopEarners />

      {/* 2 charts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopNaics />
        <SpendingByState />
      </div>
    </div>
  );
}
