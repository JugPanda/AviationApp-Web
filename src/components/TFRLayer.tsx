'use client';

import { useEffect, useState } from 'react';
import { Circle, Polygon, Popup, useMap } from 'react-leaflet';

interface TfrData {
  id: string;
  name: string;
  type: string;
  facility: string;
  state: string;
  effectiveStart: string;
  effectiveEnd: string;
  altitudeLow: number;
  altitudeHigh: number;
  description: string;
  coordinates: {
    type: 'circle' | 'polygon';
    center?: { lat: number; lng: number };
    radius?: number; // nautical miles
    points?: { lat: number; lng: number }[];
  };
  isActive: boolean;
  notamNumber?: string;
}

interface TFRLayerProps {
  visible: boolean;
}

// Convert nautical miles to meters for Leaflet
const nmToMeters = (nm: number) => nm * 1852;

// Format altitude for display
const formatAltitude = (alt: number): string => {
  if (alt === 0) return 'SFC';
  if (alt >= 18000) return `FL${Math.round(alt / 100)}`;
  return `${alt.toLocaleString()} ft`;
};

// Format date for display
const formatDate = (isoDate: string): string => {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return isoDate;
  }
};

// Get color based on TFR type
const getTfrColor = (type: string, isActive: boolean): string => {
  if (!isActive) return '#6b7280'; // gray for inactive
  
  switch (type.toUpperCase()) {
    case 'VIP':
      return '#dc2626'; // red
    case 'HAZARD':
    case 'FIRE':
      return '#f97316'; // orange
    case 'STADIUM':
    case 'SPORTING':
      return '#eab308'; // yellow
    case 'SECURITY':
      return '#7c3aed'; // purple
    default:
      return '#ef4444'; // default red
  }
};

export default function TFRLayer({ visible }: TFRLayerProps) {
  const [tfrs, setTfrs] = useState<TfrData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const fetchTfrs = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get map bounds for filtering
        const bounds = map.getBounds();
        const boundsParam = `${bounds.getSouth()},${bounds.getNorth()},${bounds.getWest()},${bounds.getEast()}`;
        
        const response = await fetch(`/api/tfr?bounds=${boundsParam}`);
        if (!response.ok) throw new Error('Failed to fetch TFRs');
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setTfrs(data);
        }
      } catch (err) {
        console.error('TFR fetch error:', err);
        setError('Failed to load TFRs');
      } finally {
        setLoading(false);
      }
    };

    fetchTfrs();
    
    // Refetch when map moves
    const onMoveEnd = () => fetchTfrs();
    map.on('moveend', onMoveEnd);
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchTfrs, 5 * 60 * 1000);
    
    return () => {
      map.off('moveend', onMoveEnd);
      clearInterval(interval);
    };
  }, [visible, map]);

  if (!visible) return null;

  return (
    <>
      {tfrs.map((tfr) => {
        const color = getTfrColor(tfr.type, tfr.isActive);
        const fillOpacity = tfr.isActive ? 0.25 : 0.1;
        const weight = tfr.isActive ? 2 : 1;
        const dashArray = tfr.isActive ? undefined : '5, 5';

        const popupContent = (
          <div className="min-w-[200px] max-w-[300px]">
            <div className="font-bold text-red-600 text-sm mb-1">
              ⚠️ TFR - {tfr.type}
            </div>
            <div className="text-xs space-y-1">
              <p className="font-medium">{tfr.name}</p>
              {tfr.notamNumber && (
                <p className="text-gray-600">{tfr.notamNumber}</p>
              )}
              <div className="border-t pt-1 mt-1">
                <p><strong>Altitude:</strong> {formatAltitude(tfr.altitudeLow)} to {formatAltitude(tfr.altitudeHigh)}</p>
                <p><strong>Effective:</strong> {formatDate(tfr.effectiveStart)}</p>
                <p><strong>Expires:</strong> {formatDate(tfr.effectiveEnd)}</p>
                {tfr.facility && <p><strong>Facility:</strong> {tfr.facility}</p>}
              </div>
              {tfr.description && (
                <p className="border-t pt-1 mt-1 text-gray-700">{tfr.description}</p>
              )}
              <p className={`font-bold mt-1 ${tfr.isActive ? 'text-red-600' : 'text-gray-500'}`}>
                {tfr.isActive ? '🔴 ACTIVE' : '⚪ Upcoming/Expired'}
              </p>
            </div>
          </div>
        );

        if (tfr.coordinates.type === 'circle' && tfr.coordinates.center) {
          return (
            <Circle
              key={tfr.id}
              center={[tfr.coordinates.center.lat, tfr.coordinates.center.lng]}
              radius={nmToMeters(tfr.coordinates.radius || 3)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity,
                weight,
                dashArray
              }}
            >
              <Popup>{popupContent}</Popup>
            </Circle>
          );
        }

        if (tfr.coordinates.type === 'polygon' && tfr.coordinates.points) {
          const positions = tfr.coordinates.points.map(p => [p.lat, p.lng] as [number, number]);
          return (
            <Polygon
              key={tfr.id}
              positions={positions}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity,
                weight,
                dashArray
              }}
            >
              <Popup>{popupContent}</Popup>
            </Polygon>
          );
        }

        return null;
      })}
    </>
  );
}
