import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Vendors from './pages/Vendors';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendors',   label: 'Vendors' },
  { id: 'upload',    label: 'Upload Data' },
];

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6 h-14">
          <span className="text-base font-bold text-blue-700 tracking-tight whitespace-nowrap">
            Sales Patriot
          </span>
          <div className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${activePage === item.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'vendors'   && <Vendors />}
        {activePage === 'upload'    && <Upload />}
      </main>
    </div>
  );
}
