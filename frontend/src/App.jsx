import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import Graph from './pages/Graph';
import Analytics from './pages/Analytics';
import Agent from './pages/Agent';
import SystemDesign from './components/SystemDesign';
import logo from './assets/salespatriot_logo.jpeg';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'vendors',   label: 'Vendors'   },
  { id: 'graph',     label: 'Sector Graph' },
  { id: 'analytics', label: 'Opportunities' },
  { id: 'agent',        label: 'Agent'         },
  { id: 'system-design', label: 'System Design' },
];

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-14">
          <img src={logo} alt="Sales Patriot" className="h-8 w-auto object-contain mr-6" />
          <div className="flex gap-1 flex-1">
            {NAV_ITEMS.filter(i => i.id !== 'system-design').map((item) => (
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
          <button
            onClick={() => setActivePage('system-design')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activePage === 'system-design'
                ? 'bg-gray-200 text-gray-900'
                : 'text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            System Design
          </button>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activePage === 'dashboard'    && <Dashboard onOpenOpportunities={() => setActivePage('analytics')} />}
        {activePage === 'vendors'      && <Vendors />}
        {activePage === 'graph'        && <Graph />}
        {activePage === 'analytics'    && <Analytics />}
        {activePage === 'agent'        && <Agent />}
        {activePage === 'system-design' && <SystemDesign />}
      </main>
    </div>
  );
}
