'use client';

import { useEffect, useMemo, memo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { MetarData } from '@/types';
import { getFlightCategoryColor, formatVisibility, formatWind, formatTemperature, formatAltimeter, formatObsTime } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

interface AirportMapProps {
  airports: MetarData[];
  selectedAirport: MetarData | null;
  onAirportSelect: (airport: MetarData) => void;
  filters: Record<string, boolean>;
  center?: [number, number];
  zoom?: number;
}

// Memoized controller to prevent unnecessary re-renders
const MapController = memo(function MapController({ selectedAirport }: { selectedAirport: MetarData | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedAirport) {
      map.flyTo([selectedAirport.lat, selectedAirport.lon], 8, {
        duration: 1
      });
    }
  }, [selectedAirport, map]);

  return null;
});

// Memoized airport marker
const AirportMarker = memo(function AirportMarker({ 
  airport, 
  isSelected, 
  onSelect 
}: { 
  airport: MetarData; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  return (
    <CircleMarker
      center={[airport.lat, airport.lon]}
      radius={isSelected ? 12 : 8}
      pathOptions={{
        fillColor: getFlightCategoryColor(airport.fltCat),
        fillOpacity: 0.9,
        color: isSelected ? '#fff' : getFlightCategoryColor(airport.fltCat),
        weight: isSelected ? 3 : 2,
      }}
      eventHandlers={{
        click: onSelect,
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
  );
});

// Map layer definitions
const MAP_LAYERS = {
  dark: {
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  streets: {
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 18,
  },
  terrain: {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
  sectional: {
    name: 'VFR Sectional',
    url: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.faa.gov/">FAA</a>',
    maxZoom: 11,
    minZoom: 5,
  },
  ifr_low: {
    name: 'IFR Low',
    url: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_Low/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.faa.gov/">FAA</a>',
    maxZoom: 11,
    minZoom: 5,
  },
  ifr_high: {
    name: 'IFR High',
    url: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/IFR_High/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.faa.gov/">FAA</a>',
    maxZoom: 11,
    minZoom: 5,
  },
};

export default function AirportMap({ 
  airports, 
  selectedAirport, 
  onAirportSelect,
  filters,
  center = [39.8283, -98.5795], // Center of US
  zoom = 4 
}: AirportMapProps) {
  // Memoize filtered airports
  const filteredAirports = useMemo(() => 
    airports.filter(airport => {
      const category = airport.fltCat || 'Unknown';
      return filters[category] !== false;
    }), 
    [airports, filters]
  );

  // Use clustering when there are many airports
  const useCluster = filteredAirports.length > 30;

  const markers = useMemo(() => 
    filteredAirports.map((airport) => (
      <AirportMarker
        key={airport.icaoId}
        airport={airport}
        isSelected={selectedAirport?.icaoId === airport.icaoId}
        onSelect={() => onAirportSelect(airport)}
      />
    )),
    [filteredAirports, selectedAirport, onAirportSelect]
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="w-full h-full"
      style={{ background: '#1e293b' }}
    >
      <LayersControl position="topright">
        {/* Base Layers */}
        <LayersControl.BaseLayer checked name="Dark">
          <TileLayer
            attribution={MAP_LAYERS.dark.attribution}
            url={MAP_LAYERS.dark.url}
            maxZoom={MAP_LAYERS.dark.maxZoom}
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="Streets">
          <TileLayer
            attribution={MAP_LAYERS.streets.attribution}
            url={MAP_LAYERS.streets.url}
            maxZoom={MAP_LAYERS.streets.maxZoom}
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution={MAP_LAYERS.satellite.attribution}
            url={MAP_LAYERS.satellite.url}
            maxZoom={MAP_LAYERS.satellite.maxZoom}
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="Terrain">
          <TileLayer
            attribution={MAP_LAYERS.terrain.attribution}
            url={MAP_LAYERS.terrain.url}
            maxZoom={MAP_LAYERS.terrain.maxZoom}
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="VFR Sectional">
          <TileLayer
            attribution={MAP_LAYERS.sectional.attribution}
            url={MAP_LAYERS.sectional.url}
            maxZoom={MAP_LAYERS.sectional.maxZoom}
            minZoom={MAP_LAYERS.sectional.minZoom}
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="IFR Low">
          <TileLayer
            attribution={MAP_LAYERS.ifr_low.attribution}
            url={MAP_LAYERS.ifr_low.url}
            maxZoom={MAP_LAYERS.ifr_low.maxZoom}
            minZoom={MAP_LAYERS.ifr_low.minZoom}
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="IFR High">
          <TileLayer
            attribution={MAP_LAYERS.ifr_high.attribution}
            url={MAP_LAYERS.ifr_high.url}
            maxZoom={MAP_LAYERS.ifr_high.maxZoom}
            minZoom={MAP_LAYERS.ifr_high.minZoom}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <MapController selectedAirport={selectedAirport} />
      
      {useCluster ? (
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
        >
          {markers}
        </MarkerClusterGroup>
      ) : (
        markers
      )}
    </MapContainer>
  );
}
