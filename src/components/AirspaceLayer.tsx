'use client';

import { useEffect, useState, useMemo } from 'react';
import { Circle, Popup, useMap } from 'react-leaflet';

interface AirspaceRing {
  floor: number;
  ceiling: number;
  radius: number;
}

interface AirspaceData {
  id: string;
  name: string;
  type: 'B' | 'C' | 'D' | 'E' | 'MOA' | 'RESTRICTED' | 'PROHIBITED';
  floor: number;
  ceiling: number;
  floorType: 'AGL' | 'MSL';
  ceilingType: 'AGL' | 'MSL';
  center: { lat: number; lng: number };
  rings: AirspaceRing[];
}

interface AirspaceLayerProps {
  visible: boolean;
  showClassB?: boolean;
  showClassC?: boolean;
  showClassD?: boolean;
}

// Convert nautical miles to meters
const nmToMeters = (nm: number) => nm * 1852;

// Get color for airspace type (matches FAA chart colors)
function getAirspaceStyle(type: string, ringIndex: number) {
  const opacity = Math.max(0.08, 0.2 - ringIndex * 0.03);
  
  switch (type) {
    case 'B':
      return {
        color: '#3b82f6', // Blue (matches sectional)
        fillColor: '#3b82f6',
        fillOpacity: opacity,
        weight: 2,
        dashArray: undefined as string | undefined,
      };
    case 'C':
      return {
        color: '#c026d3', // Magenta (matches sectional)
        fillColor: '#c026d3',
        fillOpacity: opacity,
        weight: 2,
        dashArray: undefined as string | undefined,
      };
    case 'D':
      return {
        color: '#3b82f6', // Blue dashed
        fillColor: '#3b82f6',
        fillOpacity: opacity,
        weight: 2,
        dashArray: '5, 5',
      };
    case 'E':
      return {
        color: '#c026d3', // Magenta dashed
        fillColor: '#c026d3',
        fillOpacity: opacity * 0.5,
        weight: 1,
        dashArray: '8, 4',
      };
    default:
      return {
        color: '#6b7280',
        fillColor: '#6b7280',
        fillOpacity: opacity,
        weight: 1,
        dashArray: undefined as string | undefined,
      };
  }
}

// Format altitude for display
function formatAlt(alt: number, type: string): string {
  if (alt === 0 && type === 'AGL') return 'SFC';
  if (alt >= 18000) return `FL${Math.round(alt / 100)}`;
  return `${alt.toLocaleString()}'`;
}

export default function AirspaceLayer({ 
  visible, 
  showClassB = true, 
  showClassC = true, 
  showClassD = true 
}: AirspaceLayerProps) {
  const [airspaces, setAirspaces] = useState<AirspaceData[]>([]);
  const [loading, setLoading] = useState(false);
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const fetchAirspace = async () => {
      setLoading(true);
      try {
        const bounds = map.getBounds();
        const boundsParam = `${bounds.getSouth()},${bounds.getNorth()},${bounds.getWest()},${bounds.getEast()}`;
        const types = [];
        if (showClassB) types.push('B');
        if (showClassC) types.push('C');
        if (showClassD) types.push('D');
        
        const response = await fetch(`/api/airspace?bounds=${boundsParam}&types=${types.join(',')}`);
        if (!response.ok) throw new Error('Failed to fetch airspace');
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setAirspaces(data);
        }
      } catch (error) {
        console.error('Airspace fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAirspace();
    
    const onMoveEnd = () => fetchAirspace();
    map.on('moveend', onMoveEnd);
    
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [visible, map, showClassB, showClassC, showClassD]);

  // Only show detailed rings at higher zoom levels
  const zoom = map.getZoom();
  const showRings = zoom >= 7;

  const elements = useMemo(() => {
    if (!visible) return null;
    
    return airspaces.map((airspace) => {
      const style = getAirspaceStyle(airspace.type, 0);
      
      if (showRings) {
        // Show individual rings with altitude labels
        return airspace.rings.map((ring, ringIndex) => {
          const ringStyle = getAirspaceStyle(airspace.type, ringIndex);
          
          return (
            <Circle
              key={`${airspace.id}-ring-${ringIndex}`}
              center={[airspace.center.lat, airspace.center.lng]}
              radius={nmToMeters(ring.radius)}
              pathOptions={ringStyle}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <div className="font-bold text-sm mb-1">
                    {airspace.type === 'B' ? '🔵' : airspace.type === 'C' ? '🟣' : '🔷'}{' '}
                    Class {airspace.type} — {airspace.name}
                  </div>
                  <div className="text-xs space-y-1">
                    <p><strong>Ring {ringIndex + 1}:</strong> {ring.radius} nm radius</p>
                    <p><strong>Floor:</strong> {formatAlt(ring.floor, airspace.floorType)} {airspace.floorType}</p>
                    <p><strong>Ceiling:</strong> {formatAlt(ring.ceiling, airspace.ceilingType)} {airspace.ceilingType}</p>
                    <p className="border-t pt-1 mt-1 text-gray-600">
                      {airspace.type === 'B' && 'ATC clearance required for all aircraft'}
                      {airspace.type === 'C' && 'Two-way radio & ATC contact required'}
                      {airspace.type === 'D' && 'Two-way radio & ATC contact required'}
                    </p>
                  </div>
                </div>
              </Popup>
            </Circle>
          );
        });
      } else {
        // At low zoom, show single circle (outermost ring)
        const outerRing = airspace.rings[airspace.rings.length - 1];
        
        return (
          <Circle
            key={airspace.id}
            center={[airspace.center.lat, airspace.center.lng]}
            radius={nmToMeters(outerRing.radius)}
            pathOptions={{
              ...style,
              fillOpacity: 0.1,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <div className="font-bold text-sm mb-1">
                  Class {airspace.type} — {airspace.name}
                </div>
                <div className="text-xs">
                  <p><strong>Floor:</strong> {formatAlt(airspace.floor, airspace.floorType)} {airspace.floorType}</p>
                  <p><strong>Ceiling:</strong> {formatAlt(airspace.ceiling, airspace.ceilingType)} {airspace.ceilingType}</p>
                  <p className="text-gray-500 mt-1">Zoom in for ring details</p>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      }
    });
  }, [airspaces, visible, showRings]);

  if (!visible) return null;

  return <>{elements}</>;
}
