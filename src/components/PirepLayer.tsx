'use client';

import { useEffect, useState } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';

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

// Color based on severity
function getPirepColor(pirep: PirepData): string {
  if (pirep.reportType === 'URGENT') return '#ef4444'; // red
  
  if (pirep.turbulence) {
    const t = pirep.turbulence.intensity;
    if (t.includes('SEV') || t.includes('EXTRM')) return '#ef4444';
    if (t.includes('MOD')) return '#f97316';
    return '#eab308';
  }
  
  if (pirep.icing) {
    const i = pirep.icing.intensity;
    if (i.includes('SEV')) return '#ef4444';
    if (i.includes('MOD')) return '#f97316';
    return '#3b82f6';
  }
  
  return '#22c55e'; // green for other reports
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
  } catch { return '--'; }
}

export default function PirepLayer({ visible }: PirepLayerProps) {
  const [pireps, setPireps] = useState<PirepData[]>([]);
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const fetchPireps = async () => {
      try {
        const bounds = map.getBounds();
        const boundsParam = `${bounds.getSouth()},${bounds.getNorth()},${bounds.getWest()},${bounds.getEast()}`;
        
        const response = await fetch(`/api/pirep?bounds=${boundsParam}&hours=3`);
        if (!response.ok) throw new Error('Failed');
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setPireps(data.filter((p: PirepData) => p.lat && p.lon));
        }
      } catch (error) {
        console.error('PIREP fetch error:', error);
      }
    };

    fetchPireps();
    
    const onMoveEnd = () => fetchPireps();
    map.on('moveend', onMoveEnd);
    
    const interval = setInterval(fetchPireps, 5 * 60 * 1000);
    
    return () => {
      map.off('moveend', onMoveEnd);
      clearInterval(interval);
    };
  }, [visible, map]);

  if (!visible) return null;

  return (
    <>
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
                  
                  {pirep.temperature != null && (
                    <p><strong>Temp:</strong> {pirep.temperature}°C</p>
                  )}
                  
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
