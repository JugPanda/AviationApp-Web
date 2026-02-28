'use client';

import dynamic from 'next/dynamic';
import { MetarData } from '@/types';

const AirportMap = dynamic(() => import('./AirportMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-800">
      <div className="text-center">
        <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-slate-400">Loading map...</p>
      </div>
    </div>
  ),
});

interface MapWrapperProps {
  airports: MetarData[];
  selectedAirport: MetarData | null;
  onAirportSelect: (airport: MetarData) => void;
}

export default function MapWrapper({ airports, selectedAirport, onAirportSelect }: MapWrapperProps) {
  return <AirportMap airports={airports} selectedAirport={selectedAirport} onAirportSelect={onAirportSelect} />;
}
