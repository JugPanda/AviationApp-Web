'use client';

import { CloudLayer } from '@/types';
import { getCloudCoverDescription, assessCeiling, getSafetyClass } from '@/lib/weather-utils';

interface CloudVisualizationProps {
  clouds?: CloudLayer[];
  maxAltitude?: number;
  showScale?: boolean;
  compact?: boolean;
}

export default function CloudVisualization({
  clouds,
  maxAltitude = 20000,
  showScale = true,
  compact = false
}: CloudVisualizationProps) {
  if (!clouds || clouds.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'p-2' : 'p-4'} bg-slate-800/50 rounded-lg`}>
        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span className="text-green-400">Clear Skies</span>
      </div>
    );
  }

  const sortedClouds = [...clouds].sort((a, b) => a.base - b.base);
  const ceilingLevel = assessCeiling(clouds);
  const ceilingClass = getSafetyClass(ceilingLevel);

  // Get cloud cover opacity
  const getCoverOpacity = (cover: string): number => {
    switch (cover) {
      case 'FEW': return 0.2;
      case 'SCT': return 0.4;
      case 'BKN': return 0.7;
      case 'OVC':
      case 'VV': return 0.9;
      default: return 0.3;
    }
  };

  // Get cloud color based on coverage
  const getCoverColor = (cover: string): string => {
    switch (cover) {
      case 'FEW': return 'from-slate-400/20 to-slate-500/30';
      case 'SCT': return 'from-slate-400/40 to-slate-500/50';
      case 'BKN': return 'from-slate-400/70 to-slate-500/80';
      case 'OVC':
      case 'VV': return 'from-slate-300/90 to-slate-400/95';
      default: return 'from-slate-400/30 to-slate-500/40';
    }
  };

  if (compact) {
    return (
      <div className="space-y-1">
        {sortedClouds.map((cloud, i) => {
          const isCeiling = ['BKN', 'OVC', 'VV'].includes(cloud.cover) && 
            i === sortedClouds.findIndex(c => ['BKN', 'OVC', 'VV'].includes(c.cover));
          
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-2 py-1 rounded text-sm ${
                isCeiling ? ceilingClass : 'bg-slate-700/50'
              }`}
            >
              <span className="font-medium">{cloud.cover}</span>
              <span>{cloud.base.toLocaleString()} ft</span>
              {isCeiling && <span className="text-xs ml-1">(ceiling)</span>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg p-4">
      <h3 className="text-sm font-medium text-slate-400 mb-3">Cloud Layers</h3>
      
      <div className="relative flex gap-4">
        {/* Vertical scale */}
        {showScale && (
          <div className="flex flex-col justify-between h-48 text-xs text-slate-500 w-12 shrink-0">
            <span>{(maxAltitude / 1000).toFixed(0)}k ft</span>
            <span>{(maxAltitude * 0.75 / 1000).toFixed(0)}k ft</span>
            <span>{(maxAltitude * 0.5 / 1000).toFixed(0)}k ft</span>
            <span>{(maxAltitude * 0.25 / 1000).toFixed(0)}k ft</span>
            <span>SFC</span>
          </div>
        )}
        
        {/* Sky visualization */}
        <div className="flex-1 relative h-48 bg-gradient-to-t from-slate-950 via-slate-900 to-blue-950 rounded-lg overflow-hidden border border-slate-700">
          {/* Flight category zone indicators */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            {/* LIFR < 500 ft */}
            <div className="absolute bottom-0 left-0 right-0 bg-purple-500" style={{ height: `${(500 / maxAltitude) * 100}%` }} />
            {/* IFR 500-1000 ft */}
            <div className="absolute left-0 right-0 bg-red-500" style={{ bottom: `${(500 / maxAltitude) * 100}%`, height: `${(500 / maxAltitude) * 100}%` }} />
            {/* MVFR 1000-3000 ft */}
            <div className="absolute left-0 right-0 bg-blue-500" style={{ bottom: `${(1000 / maxAltitude) * 100}%`, height: `${(2000 / maxAltitude) * 100}%` }} />
          </div>
          
          {/* Cloud layers */}
          {sortedClouds.map((cloud, i) => {
            const bottomPercent = (cloud.base / maxAltitude) * 100;
            const heightPercent = Math.max(5, 100 - bottomPercent - 10);
            const isCeiling = ['BKN', 'OVC', 'VV'].includes(cloud.cover) && 
              i === sortedClouds.findIndex(c => ['BKN', 'OVC', 'VV'].includes(c.cover));
            
            return (
              <div
                key={i}
                className={`absolute left-0 right-0 bg-gradient-to-t ${getCoverColor(cloud.cover)}`}
                style={{
                  bottom: `${Math.min(bottomPercent, 90)}%`,
                  height: `${heightPercent}%`,
                  opacity: getCoverOpacity(cloud.cover)
                }}
              >
                {/* Cloud icon */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <CloudIcon className="w-6 h-6 text-white/80" />
                </div>
              </div>
            );
          })}
          
          {/* Cloud layer labels */}
          {sortedClouds.map((cloud, i) => {
            const bottomPercent = (cloud.base / maxAltitude) * 100;
            const isCeiling = ['BKN', 'OVC', 'VV'].includes(cloud.cover) && 
              i === sortedClouds.findIndex(c => ['BKN', 'OVC', 'VV'].includes(c.cover));
            
            return (
              <div
                key={`label-${i}`}
                className={`absolute right-2 text-xs font-medium px-1.5 py-0.5 rounded ${
                  isCeiling ? 'bg-slate-900/90 ' + ceilingClass : 'bg-slate-900/70 text-white'
                }`}
                style={{ bottom: `${Math.min(bottomPercent + 2, 85)}%` }}
              >
                {cloud.cover} @ {cloud.base.toLocaleString()} ft
                {isCeiling && ' ⬇'}
              </div>
            );
          })}
          
          {/* Ground line */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-600" />
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {sortedClouds.map((cloud, i) => {
          const isCeiling = ['BKN', 'OVC', 'VV'].includes(cloud.cover) && 
            i === sortedClouds.findIndex(c => ['BKN', 'OVC', 'VV'].includes(c.cover));
          
          return (
            <span
              key={i}
              className={`px-2 py-1 rounded ${isCeiling ? ceilingClass : 'bg-slate-700'}`}
            >
              {cloud.cover}: {getCloudCoverDescription(cloud.cover)}
              {isCeiling && ' (Ceiling)'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
    </svg>
  );
}
