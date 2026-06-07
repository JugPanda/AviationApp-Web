'use client';

import { useEffect, useState } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';

import MapLayerNotice from '@/components/MapLayerNotice';
import { isOverlayResponse } from '@/lib/overlay-response';

interface PirepData {
  id: string;
  receiptTime: string;
  obsTime: string;
  icaoId?: string;
  lat: number;
  lon: number;
  altitude: number;
  aircraftType?: string;
  reportType: 'PIREP' | 'URGENT';
  turbulence?: {
    intensity: string;
    type?: string;
  };
  icing?: {
    intensity: string;
    type?: string;
  };
  skyCondition?: string;
  visibility?: number;
  temperature?: number;
  rawText: string;
}

interface PirepLayerProps {
  visible: boolean;
}

function getPirepColor(pirep: PirepData): string {
  if (pirep.reportType === 'URGENT') return '#ef4444';

  if (pirep.turbulence) {
    const intensity = pirep.turbulence.intensity;
    if (intensity.includes('SEV') || intensity.includes('EXTRM')) return '#ef4444';
    if (intensity.includes('MOD')) return '#f97316';
    return '#eab308';
  }

  if (pirep.icing) {
    const intensity = pirep.icing.intensity;
    if (intensity.includes('SEV')) return '#ef4444';
    if (intensity.includes('MOD')) return '#f97316';
    return '#3b82f6';
  }

  return '#22c55e';
}

function getPirepIcon(pirep: PirepData): string {
  if (pirep.turbulence) return '🌊';
  if (pirep.icing) return '🧊';
  if (pirep.skyCondition) return '☁️';
  return '✈️';
}

function formatAlt(ft: number): string {
  if (ft >= 18000) return `FL${Math.round(ft / 100)}`;
  return `${ft.toLocaleString()}'`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '--';
  }
}

export default function PirepLayer({ visible }: PirepLayerProps) {
  const [pireps, setPireps] = useState<PirepData[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const fetchPireps = async () => {
      try {
        const bounds = map.getBounds();
        const boundsParam = `${bounds.getSouth()},${bounds.getNorth()},${bounds.getWest()},${bounds.getEast()}`;
        const response = await fetch(`/api/pirep?bounds=${boundsParam}&hours=3`);
        const data = await response.json();

        if (isOverlayResponse<PirepData>(data)) {
          setPireps(data.items.filter((pirep) => Boolean(pirep.lat && pirep.lon)));
          setNotice(data.status === 'unavailable' ? data.message ?? 'Live PIREP data is unavailable right now.' : null);
          return;
        }

        if (Array.isArray(data)) {
          setPireps(data.filter((pirep: PirepData) => pirep.lat && pirep.lon));
          setNotice(null);
          return;
        }

        throw new Error('Unexpected PIREP response shape');
      } catch (error) {
        console.error('PIREP fetch error:', error);
        setPireps([]);
        setNotice('Unable to load live PIREPs right now. Cross-check with an official briefing source.');
      }
    };

    void fetchPireps();

    const onMoveEnd = () => void fetchPireps();
    map.on('moveend', onMoveEnd);

    const interval = setInterval(() => void fetchPireps(), 5 * 60 * 1000);

    return () => {
      map.off('moveend', onMoveEnd);
      clearInterval(interval);
    };
  }, [visible, map]);

  if (!visible) return null;

  return (
    <>
      <MapLayerNotice message={notice} position="top-left" tone="amber" />
      {pireps.map((pirep) => {
        const color = getPirepColor(pirep);
        const icon = getPirepIcon(pirep);

        return (
          <CircleMarker
            key={pirep.id}
            center={[pirep.lat, pirep.lon]}
            radius={pirep.reportType === 'URGENT' ? 10 : 7}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.8,
              color: pirep.reportType === 'URGENT' ? '#fff' : color,
              weight: pirep.reportType === 'URGENT' ? 2 : 1,
            }}
          >
            <Popup>
              <div className="min-w-[200px] max-w-[280px]">
                <div className="font-bold text-sm mb-1">
                  {icon} {pirep.reportType === 'URGENT' ? '⚠️ URGENT ' : ''}PIREP
                  {pirep.icaoId && ` — ${pirep.icaoId}`}
                </div>

                <div className="text-xs space-y-1">
                  <p><strong>Time:</strong> {formatTime(pirep.obsTime)}</p>
                  <p><strong>Altitude:</strong> {formatAlt(pirep.altitude)}</p>
                  {pirep.aircraftType && <p><strong>Aircraft:</strong> {pirep.aircraftType}</p>}

                  {pirep.turbulence && (
                    <div className="border-t pt-1 mt-1">
                      <p style={{ color: '#f97316' }}>
                        <strong>🌊 Turbulence:</strong> {pirep.turbulence.intensity}
                        {pirep.turbulence.type && ` (${pirep.turbulence.type})`}
                      </p>
                    </div>
                  )}

                  {pirep.icing && (
                    <div className="border-t pt-1 mt-1">
                      <p style={{ color: '#3b82f6' }}>
                        <strong>🧊 Icing:</strong> {pirep.icing.intensity}
                        {pirep.icing.type && ` (${pirep.icing.type})`}
                      </p>
                    </div>
                  )}

                  {pirep.temperature != null && <p><strong>Temp:</strong> {pirep.temperature}°C</p>}

                  <details className="border-t pt-1 mt-1">
                    <summary className="text-gray-500 cursor-pointer">Raw PIREP</summary>
                    <pre className="text-[10px] whitespace-pre-wrap mt-1">{pirep.rawText}</pre>
                  </details>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
