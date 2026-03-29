import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import VendorDetail from './pages/VendorDetail';
import Graph from './pages/Graph';
import Analytics from './pages/Analytics';
import logo from './assets/salespatriot_logo.jpeg';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendors',   label: 'Vendors'   },
  { id: 'graph',     label: 'Sector Graph' },
  { id: 'analytics', label: 'Analytics' },
];

export default function App() {
  const [activePage,      setActivePage]      = useState('dashboard');
  const [selectedVendor,  setSelectedVendor]  = useState(null);

  function handleVendorClick(row) {
    setSelectedVendor(row);
    setActivePage('vendor-detail');
  }

  function handleVendorBack() {
    setActivePage('vendors');
  }

  function handleNavClick(id) {
    setActivePage(id);
    if (id !== 'vendor-detail') setSelectedVendor(null);
  }

  // 'vendor-detail' is a sub-page of 'vendors' — keep Vendors tab highlighted
  const activeNav = activePage === 'vendor-detail' ? 'vendors' : activePage;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-6 h-14">
          <img src={logo} alt="Sales Patriot" className="h-8 w-auto object-contain" />
          <div className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${activeNav === item.id
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
        {activePage === 'dashboard'     && <Dashboard />}
        {activePage === 'vendors'       && <Vendors onVendorClick={handleVendorClick} />}
        {activePage === 'vendor-detail' && selectedVendor && (
          <VendorDetail
            cageCode={selectedVendor.cageCode || selectedVendor.uei}
            vendorName={selectedVendor.name}
            onBack={handleVendorBack}
          />
        )}
        {activePage === 'graph'         && <Graph />}
        {activePage === 'analytics'     && <Analytics />}
      </main>
    </div>
  );
}
