'use client';

import { useState } from 'react';
import Link from 'next/link';
import WeightBalance from '@/components/tools/WeightBalance';
import DensityAltitude from '@/components/tools/DensityAltitude';

type Tool = 'weight-balance' | 'density-altitude';

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<Tool>('weight-balance');

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Back to Map</span>
          </Link>
          
          <div className="flex-1">
            <h1 className="text-lg font-bold">Pilot Tools</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Flight planning calculators</p>
          </div>
        </div>
      </header>

      {/* Tool Navigation */}
      <div className="bg-slate-900/50 border-b border-slate-700">
        <div className="flex overflow-x-auto">
          <ToolTab 
            active={activeTool === 'weight-balance'} 
            onClick={() => setActiveTool('weight-balance')}
            icon="⚖️"
            label="Weight & Balance"
          />
          <ToolTab 
            active={activeTool === 'density-altitude'} 
            onClick={() => setActiveTool('density-altitude')}
            icon="🏔️"
            label="Density Altitude"
          />
        </div>
      </div>

      {/* Tool Content */}
      <div className="p-4 max-w-4xl mx-auto">
        {activeTool === 'weight-balance' && <WeightBalance />}
        {activeTool === 'density-altitude' && <DensityAltitude />}
      </div>
    </main>
  );
}

function ToolTab({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: string; 
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
        active 
          ? 'text-blue-400 border-blue-400 bg-slate-800/50' 
          : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/30'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
