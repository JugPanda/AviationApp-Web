'use client';

import React from 'react';
import { assessWind, getSafetyClass } from '@/lib/weather-utils';

interface WindDisplayProps {
  direction: number | null | undefined;
  speed: number | null | undefined;
  gust?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

export default function WindDisplay({
  direction,
  speed,
  gust,
  size = 'md',
  showLabel = true,
  animated = true
}: WindDisplayProps) {
  const isCalm = speed === null || speed === undefined || speed === 0;
  const level = assessWind(speed, gust);
  const safetyClass = getSafetyClass(level);
  
  const sizes = {
    sm: { container: 'w-12 h-12', arrow: 'w-8 h-8', text: 'text-xs' },
    md: { container: 'w-16 h-16', arrow: 'w-10 h-10', text: 'text-sm' },
    lg: { container: 'w-24 h-24', arrow: 'w-16 h-16', text: 'text-base' }
  };

  const sizeConfig = sizes[size];

  if (isCalm) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={`${sizeConfig.container} flex items-center justify-center rounded-full bg-slate-700/50 border-2 border-slate-600`}>
          <span className={`${sizeConfig.text} text-slate-400 font-medium`}>CALM</span>
        </div>
        {showLabel && (
          <span className="text-xs text-slate-500">No Wind</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Wind Circle with Arrow */}
      <div className={`${sizeConfig.container} relative flex items-center justify-center rounded-full border-2 ${safetyClass} bg-slate-800`}>
        {/* Compass marks */}
        <div className="absolute inset-1">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] text-slate-500">N</span>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-slate-500">S</span>
          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[8px] text-slate-500">W</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[8px] text-slate-500">E</span>
        </div>
        
        {/* Wind Arrow */}
        <svg
          className={`${sizeConfig.arrow} ${animated && gust ? 'animate-pulse' : ''}`}
          viewBox="0 0 24 24"
          style={{
            transform: `rotate(${(direction ?? 0) + 180}deg)`,
            transition: 'transform 0.5s ease-out'
          }}
        >
          <defs>
            <linearGradient id="windGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          {/* Arrow pointing up (will be rotated to wind direction + 180 for "from" direction) */}
          <path
            d="M12 2L6 12h4v8h4v-8h4L12 2z"
            fill="url(#windGradient)"
            className="drop-shadow"
          />
        </svg>
        
        {/* Speed overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`${sizeConfig.text} font-bold drop-shadow`}>
            {speed}
          </span>
        </div>
      </div>
      
      {/* Label */}
      {showLabel && (
        <div className="text-center">
          <div className={`${sizeConfig.text} font-medium`}>
            {direction?.toString().padStart(3, '0')}° @ {speed} kt
            {gust && <span className="text-orange-400"> G{gust}</span>}
          </div>
          <div className={`text-xs px-2 py-0.5 rounded ${safetyClass}`}>
            {level === 'good' && 'Light'}
            {level === 'caution' && 'Moderate'}
            {level === 'marginal' && 'Strong'}
            {level === 'hazardous' && 'Dangerous'}
          </div>
        </div>
      )}
    </div>
  );
}

// Wind barbs SVG component for meteorological display
export function WindBarbs({
  direction,
  speed,
  size = 48,
  className = ''
}: {
  direction: number | null | undefined;
  speed: number | null | undefined;
  size?: number;
  className?: string;
}) {
  if (speed === null || speed === undefined || speed === 0) {
    // Calm wind - circle
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" />
      </svg>
    );
  }
  
  // Generate barbs based on speed
  const barbs: React.ReactElement[] = [];
  let remainingSpeed = speed;
  let barbY = 4;
  const barbSpacing = 2.5;
  
  // Pennants (50 kt each)
  while (remainingSpeed >= 50) {
    barbs.push(
      <path
        key={`pennant-${barbY}`}
        d={`M12 ${barbY} L18 ${barbY + 2} L12 ${barbY + 4} Z`}
        fill="currentColor"
      />
    );
    barbY += barbSpacing * 2;
    remainingSpeed -= 50;
  }
  
  // Full barbs (10 kt each)
  while (remainingSpeed >= 10) {
    barbs.push(
      <line
        key={`full-${barbY}`}
        x1="12"
        y1={barbY}
        x2="18"
        y2={barbY - 2}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    );
    barbY += barbSpacing;
    remainingSpeed -= 10;
  }
  
  // Half barb (5 kt)
  if (remainingSpeed >= 5) {
    barbs.push(
      <line
        key={`half-${barbY}`}
        x1="12"
        y1={barbY}
        x2="15"
        y2={barbY - 1}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    );
  }
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{
        transform: `rotate(${(direction ?? 0) + 180}deg)`,
      }}
    >
      {/* Staff */}
      <line
        x1="12"
        y1="4"
        x2="12"
        y2="20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Circle at end */}
      <circle cx="12" cy="20" r="2" fill="currentColor" />
      {/* Barbs */}
      {barbs}
    </svg>
  );
}
