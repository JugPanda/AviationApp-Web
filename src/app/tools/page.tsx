'use client';

import { lazy, Suspense, useState } from 'react';
import AppShell from '@/components/AppShell';
import WeightBalance from '@/components/tools/WeightBalance';
import './tools.css';

// Keep the first calculator server-rendered; load other tools only on selection.
const DensityAltitude = lazy(() => import('@/components/tools/DensityAltitude'));
const CrosswindCalculator = lazy(() => import('@/components/tools/CrosswindCalculator'));
const TimeSpeedDistance = lazy(() => import('@/components/tools/TimeSpeedDistance'));
const FuelCalculator = lazy(() => import('@/components/tools/FuelCalculator'));
const WindCalculator = lazy(() => import('@/components/tools/WindCalculator'));
const AltitudeCalculator = lazy(() => import('@/components/tools/AltitudeCalculator'));
const SunCalculator = lazy(() => import('@/components/tools/SunCalculator'));
const Timer = lazy(() => import('@/components/tools/Timer'));
const HoldingPattern = lazy(() => import('@/components/tools/HoldingPattern'));

type Tool = 'weight-balance' | 'density-altitude' | 'crosswind' | 'time-speed-distance' | 'fuel' | 'wind' | 'altitude' | 'sun' | 'timer' | 'holding';
type Category = 'performance' | 'planning' | 'utility';

interface ToolConfig {
  id: Tool;
  label: string;
  category: Category;
  help: string;
}

const TOOLS: ToolConfig[] = [
  { id: 'weight-balance', label: 'Weight & Balance', category: 'performance', help: 'Set aircraft, fuel, and payload. Compare the calculated loading with the selected, unverified limits.' },
  { id: 'density-altitude', label: 'Density Altitude', category: 'performance', help: 'Enter field conditions to estimate density altitude. Use your aircraft’s POH for performance planning.' },
  { id: 'altitude', label: 'Altitude & Airspeed', category: 'performance', help: 'Compare pressure, density, and true altitude, or estimate true airspeed from your flight conditions.' },
  { id: 'crosswind', label: 'Crosswind', category: 'performance', help: 'Resolve wind into runway components. Use the same heading reference for the runway and wind direction.' },
  { id: 'time-speed-distance', label: 'Time / Speed / Distance', category: 'planning', help: 'Choose the value to solve for, then enter the other two. Check the units beside each input.' },
  { id: 'fuel', label: 'Fuel Calculator', category: 'planning', help: 'Estimate endurance or fuel required using your burn rate and reserve. Verify fuel and performance against your aircraft documentation.' },
  { id: 'wind', label: 'Wind Correction', category: 'planning', help: 'Enter true course, true airspeed, and wind to calculate a corrected heading and ground speed.' },
  { id: 'sun', label: 'Sunrise / Sunset', category: 'planning', help: 'Choose a date and location to estimate sun and twilight times. Adjust the UTC offset for daylight saving when needed.' },
  { id: 'holding', label: 'Holding Pattern', category: 'planning', help: 'Review a holding entry and wind corrections. Confirm the course and turn direction against your clearance.' },
  { id: 'timer', label: 'Timer & Hobbs', category: 'utility', help: 'Use a stopwatch or countdown, or calculate block and Hobbs time. Keep this tool open while timing.' },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'performance', label: 'Aircraft & performance' },
  { id: 'planning', label: 'Flight planning' },
  { id: 'utility', label: 'Time & records' },
];

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<Tool>('weight-balance');
  const currentTool = TOOLS.find(tool => tool.id === activeTool)!;

  return (
    <AppShell>
      <main id="workspace-content" tabIndex={-1} className="av-tools-page min-h-screen bg-slate-950 text-white">
        <header className="av-page-heading">
          <div>
            <p className="av-eyebrow">03 / The instrument desk</p>
            <h1>Pilot tools</h1>
            <p className="av-page-description">Planning calculations, performance references, and cockpit utilities.</p>
            <p className="av-local-note">Aircraft profiles stay in this browser. Verify inputs against your aircraft documentation.</p>
          </div>
        </header>

        <div className="av-tools-workspace">
          <nav className="av-tools-sidebar" aria-label="Pilot tools">
            <p className="av-tools-nav-heading">Tool directory <span>10 tools</span></p>
            {CATEGORIES.map(category => (
              <div className="av-tools-nav-group" key={category.id}>
                <h2>{category.label}</h2>
                {TOOLS.filter(tool => tool.category === category.id).map(tool => (
                  <button
                    key={tool.id}
                    type="button"
                    aria-pressed={activeTool === tool.id}
                    aria-controls="selected-tool"
                    onClick={() => setActiveTool(tool.id)}
                  >
                    <span>{tool.label}</span>
                    <span className="av-tools-nav-marker" aria-hidden="true">{activeTool === tool.id ? '→' : '·'}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="av-tools-mobile-selector">
            <label htmlFor="pilot-tool">Choose a tool <span>10 available</span></label>
            <select id="pilot-tool" value={activeTool} onChange={event => setActiveTool(event.target.value as Tool)} aria-controls="selected-tool">
              {CATEGORIES.map(category => (
                <optgroup key={category.id} label={category.label}>
                  {TOOLS.filter(tool => tool.category === category.id).map(tool => (
                    <option key={tool.id} value={tool.id}>{tool.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <section id="selected-tool" className="av-tools-panel" aria-labelledby="selected-tool-title">
            <header className="av-tools-panel-heading">
              <p className="av-tools-category">{CATEGORIES.find(category => category.id === currentTool.category)!.label}</p>
              <h2 id="selected-tool-title" aria-live="polite" aria-atomic="true">{currentTool.label}</h2>
              <p>{currentTool.help}</p>
            </header>
            <div className="av-tools-calculator max-w-4xl" data-tool={activeTool}>
              <Suspense key={activeTool} fallback={<p role="status" className="p-6">Loading {currentTool.label}…</p>}>
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
              </Suspense>
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
