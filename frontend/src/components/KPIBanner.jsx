const KPIs = [
  { label: 'Total Obligated',  value: '$1.61B' },
  { label: 'Total Awards',     value: '4,116'  },
  { label: 'Companies',        value: '2,379'  },
  { label: 'Sole Source Rate', value: '8.4%'   },
];

export default function KPIBanner() {
  return (
    <div className="bg-gray-900 rounded-xl p-6 flex flex-col gap-4">
      {/* Hook line */}
      <div>
        <p className="text-white text-xl font-semibold leading-snug">
          8.4% of contracts had <span className="text-yellow-400">zero competition.</span>
        </p>
        <p className="text-gray-400 text-sm mt-1">
          That's where the locked-in money is — companies winning sole source contracts year after year.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-700 pt-4">
        {KPIs.map((k) => (
          <div key={k.label}>
            <p className="text-2xl font-bold text-white tabular-nums">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
