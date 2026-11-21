'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
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
    <AppShell>
    <main id="workspace-content" tabIndex={-1} className="min-h-screen bg-slate-950 text-white">
      <header className="av-page-heading">
        <div>
          <p className="av-eyebrow">03 / The instrument desk</p>
          <h1>Pilot tools</h1>
          <p className="av-page-description">Planning calculations, performance references, and cockpit utilities.</p>
          <p className="av-local-note">Aircraft profiles are local to this browser. Verify inputs against your aircraft documentation.</p>
        </div>
        <button onClick={() => setShowToolList(!showToolList)} aria-expanded={showToolList} aria-controls="mobile-tool-list" aria-label={`Choose tool. Current tool: ${currentTool.label}`} className="sm:hidden flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-sm">
          <span aria-hidden="true">{currentTool.icon}</span>
          <span>{currentTool.shortLabel}</span>
          <span className="text-slate-400">Change tool ↓</span>
        </button>
      </header>

      {/* Mobile Tool List Dropdown */}
      {showToolList && (
        <>
          <div 
            className="sm:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowToolList(false)}
          />
          <div id="mobile-tool-list" className="av-tool-menu sm:hidden" role="dialog" aria-modal="true" aria-label="Choose a pilot tool" onKeyDown={(event) => { if (event.key === 'Escape') setShowToolList(false); }}>
            <div className="av-tool-menu-heading"><h2 className="font-semibold">Choose a tool</h2><button onClick={() => setShowToolList(false)} className="px-3 text-sm">Close</button></div>
            {Object.entries(CATEGORIES).map(([catKey, catConfig]) => (
              <div key={catKey}>
                <div className="px-4 py-2 bg-slate-800/50 text-xs font-medium text-slate-400">
                  {catConfig.label}
                </div>
                {TOOLS.filter(t => t.category === catKey).map(tool => (
                  <button
                    key={tool.id}
                    aria-pressed={activeTool === tool.id}
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
      <div className="av-subnav hidden sm:block">
        <div className="flex overflow-x-auto">
          {TOOLS.map(tool => (
            <ToolTab 
              key={tool.id}
              active={activeTool === tool.id} 
              onClick={() => setActiveTool(tool.id)}
              icon={tool.icon}
              label={tool.shortLabel}
              fullLabel={tool.label}
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
      <div className="av-tools-quickbar sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 px-2 py-2">
        <div className="grid grid-cols-4 gap-1">
          {['weight-balance', 'fuel', 'wind', 'timer'].map(toolId => {
            const tool = TOOLS.find(t => t.id === toolId)!;
            return (
              <button
                key={toolId}
                aria-label={tool.label}
                aria-pressed={activeTool === tool.id}
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
    </AppShell>
  );
}

function ToolTab({ 
  active, 
  onClick, 
  icon, 
  label,
  fullLabel
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: string; 
  label: string;
  fullLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={fullLabel}
      aria-pressed={active}
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
