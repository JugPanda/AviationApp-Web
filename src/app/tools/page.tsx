'use client';

import { useState } from 'react';
import Link from 'next/link';
import WeightBalance from '@/components/tools/WeightBalance';
import DensityAltitude from '@/components/tools/DensityAltitude';
import CrosswindCalculator from '@/components/tools/CrosswindCalculator';
import TimeSpeedDistance from '@/components/tools/TimeSpeedDistance';
import FuelCalculator from '@/components/tools/FuelCalculator';
import WindCalculator from '@/components/tools/WindCalculator';
import AltitudeCalculator from '@/components/tools/AltitudeCalculator';
import SunCalculator from '@/components/tools/SunCalculator';
import Timer from '@/components/tools/Timer';
import HoldingPattern from '@/components/tools/HoldingPattern';

type Tool = 
  | 'weight-balance' 
  | 'density-altitude' 
  | 'crosswind'
  | 'time-speed-distance'
  | 'fuel'
  | 'wind'
  | 'altitude'
  | 'sun'
  | 'timer'
  | 'holding';

interface ToolConfig {
  id: Tool;
  icon: string;
  label: string;
  shortLabel: string;
  category: 'flight' | 'performance' | 'planning' | 'utility';
}

const TOOLS: ToolConfig[] = [
  // Flight Planning
  { id: 'time-speed-distance', icon: '📏', label: 'Time/Speed/Distance', shortLabel: 'T/S/D', category: 'flight' },
  { id: 'fuel', icon: '⛽', label: 'Fuel Calculator', shortLabel: 'Fuel', category: 'flight' },
  { id: 'wind', icon: '💨', label: 'Wind Correction', shortLabel: 'Wind', category: 'flight' },
  { id: 'sun', icon: '🌅', label: 'Sunrise/Sunset', shortLabel: 'Sun', category: 'flight' },
  
  // Performance
  { id: 'weight-balance', icon: '⚖️', label: 'Weight & Balance', shortLabel: 'W&B', category: 'performance' },
  { id: 'density-altitude', icon: '🏔️', label: 'Density Altitude', shortLabel: 'DA', category: 'performance' },
  { id: 'altitude', icon: '📊', label: 'Altitude & TAS', shortLabel: 'Alt/TAS', category: 'performance' },
  { id: 'crosswind', icon: '🌬️', label: 'Crosswind', shortLabel: 'Xwind', category: 'performance' },
  
  // Utility
  { id: 'timer', icon: '⏱️', label: 'Timer & Hobbs', shortLabel: 'Timer', category: 'utility' },
  
  // IFR
  { id: 'holding', icon: '🔄', label: 'Holding Pattern', shortLabel: 'Hold', category: 'flight' },
];

const CATEGORIES = {
  flight: { label: 'Flight Planning', color: 'blue' },
  performance: { label: 'Performance', color: 'green' },
  utility: { label: 'Utility', color: 'amber' },
};

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<Tool>('weight-balance');
  const [showToolList, setShowToolList] = useState(false);

  const currentTool = TOOLS.find(t => t.id === activeTool)!;

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
            <span className="hidden sm:inline">Map</span>
          </Link>
          
          <div className="flex-1">
            <h1 className="text-lg font-bold">Pilot Tools</h1>
            <p className="text-xs text-slate-400 hidden sm:block">E6B calculators & flight planning</p>
          </div>

          {/* Mobile tool selector button */}
          <button
            onClick={() => setShowToolList(!showToolList)}
            className="sm:hidden flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg"
          >
            <span>{currentTool.icon}</span>
            <span className="text-sm">{currentTool.shortLabel}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Tool List Dropdown */}
      {showToolList && (
        <>
          <div 
            className="sm:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowToolList(false)}
          />
          <div className="sm:hidden fixed top-16 left-0 right-0 bg-slate-900 border-b border-slate-700 z-50 max-h-[70vh] overflow-y-auto">
            {Object.entries(CATEGORIES).map(([catKey, catConfig]) => (
              <div key={catKey}>
                <div className="px-4 py-2 bg-slate-800/50 text-xs font-medium text-slate-400">
                  {catConfig.label}
                </div>
                {TOOLS.filter(t => t.category === catKey).map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setActiveTool(tool.id);
                      setShowToolList(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                      activeTool === tool.id 
                        ? 'bg-blue-900/30 text-blue-400' 
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-xl">{tool.icon}</span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Desktop Tool Navigation */}
      <div className="hidden sm:block bg-slate-900/50 border-b border-slate-700">
        <div className="flex overflow-x-auto">
          {TOOLS.map(tool => (
            <ToolTab 
              key={tool.id}
              active={activeTool === tool.id} 
              onClick={() => setActiveTool(tool.id)}
              icon={tool.icon}
              label={tool.shortLabel}
            />
          ))}
        </div>
      </div>

      {/* Tool Content */}
      <div className="p-4 max-w-4xl mx-auto pb-20">
        {activeTool === 'weight-balance' && <WeightBalance />}
        {activeTool === 'density-altitude' && <DensityAltitude />}
        {activeTool === 'crosswind' && <CrosswindCalculator />}
        {activeTool === 'time-speed-distance' && <TimeSpeedDistance />}
        {activeTool === 'fuel' && <FuelCalculator />}
        {activeTool === 'wind' && <WindCalculator />}
        {activeTool === 'altitude' && <AltitudeCalculator />}
        {activeTool === 'sun' && <SunCalculator />}
        {activeTool === 'timer' && <Timer />}
        {activeTool === 'holding' && <HoldingPattern />}
      </div>

      {/* Quick tool switcher (mobile bottom bar) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 px-2 py-2">
        <div className="grid grid-cols-4 gap-1">
          {['weight-balance', 'fuel', 'wind', 'timer'].map(toolId => {
            const tool = TOOLS.find(t => t.id === toolId)!;
            return (
              <button
                key={toolId}
                onClick={() => setActiveTool(tool.id)}
                className={`flex flex-col items-center min-w-0 px-1 py-1 rounded-lg transition-colors ${
                  activeTool === tool.id ? 'bg-blue-900/30 text-blue-400' : 'text-slate-400'
                }`}
              >
                <span className="text-xl">{tool.icon}</span>
                <span className="text-[10px]">{tool.shortLabel}</span>
              </button>
            );
          })}
        </div>
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
