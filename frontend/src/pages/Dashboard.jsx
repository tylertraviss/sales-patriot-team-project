import { ArrowRight } from 'lucide-react';
import KPIBanner from '../components/KPIBanner';
import TopNaics from '../components/TopNaics';
import SpendingByState from '../components/SpendingByState';
import TopEarners from '../components/TopEarners';
import AwardsTable from '../components/AwardsTable';

export default function Dashboard({ onOpenOpportunities }) {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI banner */}
      <KPIBanner />

      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">SalesPatriot Opportunities</p>
            <h2 className="text-xl font-semibold text-slate-900">Jump into the 10-chart opportunity workspace</h2>
            <p className="max-w-3xl text-sm text-slate-600">
              Compare breakout vendors, concentration risk, sole-source pockets, geographic demand, and revenue stability on one dedicated page.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenOpportunities}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Open Opportunities
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Top earners — full width, just under KPIs */}
      <TopEarners />

      {/* 2 charts side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TopNaics />
        <SpendingByState />
      </div>

      {/* Awards table */}
      <AwardsTable cageCode={null} />
    </div>
  );
}
