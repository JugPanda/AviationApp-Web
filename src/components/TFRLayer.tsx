'use client';

import { useEffect, useState } from 'react';
import { Circle, Polygon, Popup, useMap } from 'react-leaflet';

import MapLayerNotice from '@/components/MapLayerNotice';
import { isOverlayResponse } from '@/lib/overlay-response';

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
    radius?: number;
    points?: { lat: number; lng: number }[];
  };
  isActive: boolean;
  notamNumber?: string;
}

interface TFRLayerProps {
  visible: boolean;
}

const nmToMeters = (nm: number) => nm * 1852;

const formatAltitude = (alt: number): string => {
  if (alt === 0) return 'SFC';
  if (alt >= 18000) return `FL${Math.round(alt / 100)}`;
  return `${alt.toLocaleString()} ft`;
};

const formatDate = (isoDate: string): string => {
  try {
    const date = new Date(isoDate);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoDate;
  }
};

const getTfrColor = (type: string, isActive: boolean): string => {
  if (!isActive) return '#6b7280';

  switch (type.toUpperCase()) {
    case 'VIP':
      return '#dc2626';
    case 'HAZARD':
    case 'FIRE':
      return '#f97316';
    case 'STADIUM':
    case 'SPORTING':
      return '#eab308';
    case 'SECURITY':
      return '#7c3aed';
    default:
      return '#ef4444';
  }
};

export default function TFRLayer({ visible }: TFRLayerProps) {
  const [tfrs, setTfrs] = useState<TfrData[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const fetchTfrs = async () => {
      try {
        const bounds = map.getBounds();
        const boundsParam = `${bounds.getSouth()},${bounds.getNorth()},${bounds.getWest()},${bounds.getEast()}`;
        const response = await fetch(`/api/tfr?bounds=${boundsParam}`);
        const data = await response.json();

        if (isOverlayResponse<TfrData>(data)) {
          setTfrs(data.items);
          setNotice(data.status === 'unavailable' ? data.message ?? 'Live TFR data is unavailable right now.' : null);
          return;
        }

        if (Array.isArray(data)) {
          setTfrs(data);
          setNotice(null);
          return;
        }

        throw new Error('Unexpected TFR response shape');
      } catch (err) {
        console.error('TFR fetch error:', err);
        setTfrs([]);
        setNotice('Unable to load live TFR data right now. Cross-check with an official FAA briefing source.');
      }
    };

    void fetchTfrs();

    const onMoveEnd = () => void fetchTfrs();
    map.on('moveend', onMoveEnd);

    const interval = setInterval(() => void fetchTfrs(), 5 * 60 * 1000);

    return () => {
      map.off('moveend', onMoveEnd);
      clearInterval(interval);
    };
  }, [visible, map]);

  if (!visible) return null;

  return (
    <>
      <MapLayerNotice message={notice} position="bottom-left" tone="red" />
      {tfrs.map((tfr) => {
        const color = getTfrColor(tfr.type, tfr.isActive);
        const fillOpacity = tfr.isActive ? 0.25 : 0.1;
        const weight = tfr.isActive ? 2 : 1;
        const dashArray = tfr.isActive ? undefined : '5, 5';

        const popupContent = (
          <div className="min-w-[200px] max-w-[300px]">
            <div className="font-bold text-red-600 text-sm mb-1">⚠️ TFR - {tfr.type}</div>
            <div className="text-xs space-y-1">
              <p className="font-medium">{tfr.name}</p>
              {tfr.notamNumber && <p className="text-gray-600">{tfr.notamNumber}</p>}
              <div className="border-t pt-1 mt-1">
                <p><strong>Altitude:</strong> {formatAltitude(tfr.altitudeLow)} to {formatAltitude(tfr.altitudeHigh)}</p>
                <p><strong>Effective:</strong> {formatDate(tfr.effectiveStart)}</p>
                <p><strong>Expires:</strong> {formatDate(tfr.effectiveEnd)}</p>
                {tfr.facility && <p><strong>Facility:</strong> {tfr.facility}</p>}
              </div>
              {tfr.description && <p className="border-t pt-1 mt-1 text-gray-700">{tfr.description}</p>}
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
                dashArray,
              }}
            >
              <Popup>{popupContent}</Popup>
            </Circle>
          );
        }

        if (tfr.coordinates.type === 'polygon' && tfr.coordinates.points) {
          const positions = tfr.coordinates.points.map((p) => [p.lat, p.lng] as [number, number]);
          return (
            <Polygon
              key={tfr.id}
              positions={positions}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity,
                weight,
                dashArray,
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
