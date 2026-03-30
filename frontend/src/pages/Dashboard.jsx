import { ArrowRight } from 'lucide-react';
import KPIBanner from '../components/KPIBanner';
import TopNaics from '../components/TopNaics';
import TopEarners from '../components/TopEarners';
import VendorMap from '../components/VendorMap';
import { navigateTo, setParams } from '@/hooks/useUrlState';

export default function Dashboard({ onOpenOpportunities }) {
  function handleStateClick(stateData) {
    // Navigate to Vendors page filtered by the clicked state
    setParams({ state: stateData.stateCode, view: '' });
    navigateTo('vendors');
  }

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

      {/* Top earners — full width */}
      <TopEarners />

      {/* Top NAICS — full width */}
      <TopNaics />

      {/* Geographic spend map — full width */}
      <VendorMap onStateClick={handleStateClick} />
    </div>
  );
}
