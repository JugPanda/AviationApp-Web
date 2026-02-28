'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MetarData } from '@/types';
import { getFlightCategoryColor, formatVisibility, formatWind, formatTemperature, formatAltimeter, formatObsTime } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

interface AirportMapProps {
  airports: MetarData[];
  selectedAirport: MetarData | null;
  onAirportSelect: (airport: MetarData) => void;
  center?: [number, number];
  zoom?: number;
}

function MapController({ selectedAirport }: { selectedAirport: MetarData | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedAirport) {
      map.flyTo([selectedAirport.lat, selectedAirport.lon], 8, {
        duration: 1
      });
    }
  }, [selectedAirport, map]);

  return null;
}

export default function AirportMap({ 
  airports, 
  selectedAirport, 
  onAirportSelect,
  center = [39.8283, -98.5795], // Center of US
  zoom = 4 
}: AirportMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full"
      style={{ background: '#1e293b' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <MapController selectedAirport={selectedAirport} />
      
      {airports.map((airport) => (
        <CircleMarker
          key={airport.icaoId}
          center={[airport.lat, airport.lon]}
          radius={selectedAirport?.icaoId === airport.icaoId ? 12 : 8}
          pathOptions={{
            fillColor: getFlightCategoryColor(airport.fltCat),
            fillOpacity: 0.9,
            color: selectedAirport?.icaoId === airport.icaoId ? '#fff' : getFlightCategoryColor(airport.fltCat),
            weight: selectedAirport?.icaoId === airport.icaoId ? 3 : 2,
          }}
          eventHandlers={{
            click: () => onAirportSelect(airport),
          }}
        >
          <Popup>
            <div className="min-w-[200px]">
              <div className="font-bold text-lg">{airport.icaoId}</div>
              <div className="text-sm text-gray-400 mb-2">{airport.name}</div>
              
              <div 
                className="inline-block px-2 py-1 rounded text-white text-sm font-bold mb-2"
                style={{ backgroundColor: getFlightCategoryColor(airport.fltCat) }}
              >
                {airport.fltCat || 'N/A'}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">Visibility:</span>
                  <br />{formatVisibility(airport.visib)}
                </div>
                <div>
                  <span className="text-gray-400">Wind:</span>
                  <br />{formatWind(airport.wdir, airport.wspd, airport.wgst)}
                </div>
                <div>
                  <span className="text-gray-400">Temp:</span>
                  <br />{formatTemperature(airport.temp)}
                </div>
                <div>
                  <span className="text-gray-400">Altimeter:</span>
                  <br />{formatAltimeter(airport.altim)}
                </div>
              </div>
              
              <div className="mt-2 text-xs text-gray-500">
                Observed: {formatObsTime(airport.obsTime)}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
