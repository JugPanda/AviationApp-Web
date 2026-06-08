'use client';

import { Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { isFlightTracked } from '@/lib/flight-tracking';

export interface FlightData {
  icao24: string;
  callsign: string;
  registration?: string | null;
  aircraftType?: string | null;
  originCountry: string;
  longitude: number;
  latitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  verticalRate: number;
  onGround: boolean;
  lastUpdate: number;
}

interface FlightMarkersProps {
  flights: FlightData[];
  trackedFlight: string | null;
  onFlightSelect: (flight: FlightData) => void;
}

// Create rotated airplane icon
const createPlaneIcon = (heading: number, isTracked: boolean) => {
  const color = isTracked ? '#f59e0b' : '#3b82f6';
  const size = isTracked ? 28 : 20;
  
  return L.divIcon({
    className: 'flight-marker',
    html: `
      <div style="
        transform: rotate(${heading}deg);
        color: ${color};
        font-size: ${size}px;
        text-shadow: 0 0 3px rgba(0,0,0,0.8);
        filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
      ">✈</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Convert m/s to knots
const msToKnots = (ms: number) => Math.round(ms * 1.944);

// Convert meters to feet
const metersToFeet = (m: number) => Math.round(m * 3.281);

export default function FlightMarkers({ flights, trackedFlight, onFlightSelect }: FlightMarkersProps) {
  const map = useMap();
  
  // Auto-center on tracked flight
  useEffect(() => {
    if (trackedFlight) {
      const flight = flights.find((candidate) => isFlightTracked(candidate, trackedFlight));
      if (flight) {
        map.setView([flight.latitude, flight.longitude], Math.max(map.getZoom(), 7), { animate: true });
      }
    }
  }, [trackedFlight, flights, map]);
  
  const sortedFlights = useMemo(() => {
    // Put tracked flight last so it renders on top
    return [...flights].sort((a, b) => {
      const aTracked = isFlightTracked(a, trackedFlight);
      const bTracked = isFlightTracked(b, trackedFlight);
      return aTracked ? 1 : bTracked ? -1 : 0;
    });
  }, [flights, trackedFlight]);
  
  return (
    <>
      {sortedFlights.map((flight) => {
        const isTracked = isFlightTracked(flight, trackedFlight);
        
        return (
          <Marker
            key={flight.icao24}
            position={[flight.latitude, flight.longitude]}
            icon={createPlaneIcon(flight.heading, isTracked)}
            eventHandlers={{
              click: () => onFlightSelect(flight),
            }}
          >
            <Popup>
              <div className="text-sm min-w-[180px]">
                <div className="font-bold text-lg text-blue-600">{flight.callsign}</div>
                <div className="text-gray-500 text-xs mb-2">
                  {[flight.registration, flight.icao24, flight.aircraftType].filter(Boolean).join(' • ')}
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Altitude:</span>
                    <div className="font-medium">
                      {flight.onGround ? 'On Ground' : `${metersToFeet(flight.altitude).toLocaleString()} ft`}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Speed:</span>
                    <div className="font-medium">{msToKnots(flight.velocity)} kts</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Heading:</span>
                    <div className="font-medium">{Math.round(flight.heading)}°</div>
                  </div>
                  <div>
                    <span className="text-gray-500">V/S:</span>
                    <div className="font-medium">
                      {flight.verticalRate > 0 ? '↑' : flight.verticalRate < 0 ? '↓' : '—'}
                      {Math.abs(Math.round(flight.verticalRate * 196.85))} fpm
                    </div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
