'use client';

import { useEffect, useMemo, memo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, LayersControl, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';
import { MetarData } from '@/types';
import { getFlightCategoryColor, formatVisibility, formatWind, formatTemperature, formatAltimeter, formatObsTime } from '@/lib/utils';
import FlightMarkers, { FlightData } from './FlightMarkers';
import 'leaflet/dist/leaflet.css';

interface AirportMapProps {
  airports: MetarData[];
  selectedAirport: MetarData | null;
  onAirportSelect: (airport: MetarData) => void;
  filters: Record<string, boolean>;
  center?: [number, number];
  zoom?: number;
  flights?: FlightData[];
  trackedFlight?: string | null;
  onFlightSelect?: (flight: FlightData) => void;
  showFlights?: boolean;
}

// Custom icon for user location
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #3b82f6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Location control component
const LocationControl = memo(function LocationControl({ 
  userLocation, 
  onLocate,
  isLocating 
}: { 
  userLocation: [number, number] | null;
  onLocate: () => void;
  isLocating: boolean;
}) {
  const map = useMap();

  const handleClick = () => {
    if (userLocation) {
      map.flyTo(userLocation, 10, { duration: 1 });
    } else {
      onLocate();
    }
  };

  return (
    <div className="leaflet-top leaflet-left" style={{ marginTop: '80px' }}>
      <div className="leaflet-control leaflet-bar">
        <button
          onClick={handleClick}
          disabled={isLocating}
          title={userLocation ? "Go to my location" : "Find my location"}
          style={{
            width: '34px',
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            border: 'none',
            cursor: isLocating ? 'wait' : 'pointer',
            borderRadius: '4px',
          }}
        >
          {isLocating ? (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={userLocation ? "#3b82f6" : "#333"} strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
});

// User location marker
const UserLocationMarker = memo(function UserLocationMarker({ 
  position, 
  accuracy 
}: { 
  position: [number, number];
  accuracy: number;
}) {
  return (
    <>
      {/* Accuracy circle */}
      <Circle
        center={position}
        radius={accuracy}
        pathOptions={{
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          color: '#3b82f6',
          weight: 1,
          opacity: 0.3,
        }}
      />
      {/* Location dot */}
      <Marker position={position} icon={userLocationIcon}>
        <Popup>
          <div className="text-center">
            <div className="font-bold">Your Location</div>
            <div className="text-sm text-gray-400">
              {position[0].toFixed(4)}, {position[1].toFixed(4)}
            </div>
            <div className="text-xs text-gray-500">
              Accuracy: ±{Math.round(accuracy)}m
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
});

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
  // Skip if invalid coordinates
  if (typeof airport.lat !== 'number' || typeof airport.lon !== 'number' || 
      isNaN(airport.lat) || isNaN(airport.lon)) {
    return null;
  }

  const fltCat = airport.fltCat ?? null;

  return (
    <CircleMarker
      center={[airport.lat, airport.lon]}
      radius={isSelected ? 12 : 8}
      pathOptions={{
        fillColor: getFlightCategoryColor(fltCat),
        fillOpacity: 0.9,
        color: isSelected ? '#fff' : getFlightCategoryColor(fltCat),
        weight: isSelected ? 3 : 2,
      }}
      eventHandlers={{
        click: onSelect,
      }}
    >
      <Popup>
        <div className="min-w-[200px]">
          <div className="font-bold text-lg">{airport.icaoId || 'Unknown'}</div>
          <div className="text-sm text-gray-400 mb-2">{airport.name || 'Unknown Airport'}</div>
          
          <div 
            className="inline-block px-2 py-1 rounded text-white text-sm font-bold mb-2"
            style={{ backgroundColor: getFlightCategoryColor(fltCat) }}
          >
            {fltCat || 'N/A'}
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
  zoom = 4,
  flights = [],
  trackedFlight = null,
  onFlightSelect,
  showFlights = false,
}: AirportMapProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number>(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocationAccuracy(position.coords.accuracy);
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location unavailable');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out');
            break;
          default:
            setLocationError('Unable to get location');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  // Memoize filtered airports with coordinate validation
  const filteredAirports = useMemo(() => 
    airports.filter(airport => {
      // Validate coordinates
      if (!airport.lat || !airport.lon || isNaN(airport.lat) || isNaN(airport.lon)) {
        return false;
      }
      const category = airport.fltCat || 'Unknown';
      return filters[category] !== false;
    }), 
    [airports, filters]
  );

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
      {/* Location control button */}
      <LocationControl 
        userLocation={userLocation} 
        onLocate={handleLocate}
        isLocating={isLocating}
      />

      {/* User location marker */}
      {userLocation && (
        <UserLocationMarker 
          position={userLocation} 
          accuracy={locationAccuracy} 
        />
      )}

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
      
      {markers}
      
      {/* Flight tracking layer */}
      {showFlights && flights.length > 0 && onFlightSelect && (
        <FlightMarkers 
          flights={flights} 
          trackedFlight={trackedFlight} 
          onFlightSelect={onFlightSelect} 
        />
      )}
    </MapContainer>
  );
}
