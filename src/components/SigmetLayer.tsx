'use client';

import { useEffect, useState } from 'react';
import { Polygon, Popup, useMap } from 'react-leaflet';

interface SigmetData {
  id: string;
  type: 'SIGMET' | 'AIRMET';
  subType: string;
  hazard: string;
  severity?: string;
  validFrom: string;
  validTo: string;
  altitudeLow?: number;
  altitudeHigh?: number;
  rawText: string;
  coords: { lat: number; lng: number }[];
  isActive: boolean;
}

interface SigmetLayerProps {
  visible: boolean;
}

function getSigmetStyle(sigmet: SigmetData) {
  const isSigmet = sigmet.type === 'SIGMET';
  
  // Color by hazard type
  if (sigmet.subType.includes('CONV') || sigmet.subType.includes('TS')) {
    return {
      color: '#ef4444', fillColor: '#ef4444',
      fillOpacity: 0.15, weight: 2
    };
  }
  if (sigmet.subType.includes('TURB')) {
    return {
      color: '#f97316', fillColor: '#f97316',
      fillOpacity: isSigmet ? 0.2 : 0.12, weight: isSigmet ? 2 : 1.5
    };
  }
  if (sigmet.subType.includes('ICE') || sigmet.subType.includes('ICG')) {
    return {
      color: '#3b82f6', fillColor: '#3b82f6',
      fillOpacity: isSigmet ? 0.2 : 0.12, weight: isSigmet ? 2 : 1.5
    };
  }
  if (sigmet.subType.includes('IFR') || sigmet.subType.includes('MTN')) {
    return {
      color: '#8b5cf6', fillColor: '#8b5cf6',
      fillOpacity: 0.12, weight: 1.5
    };
  }
  
  return {
    color: isSigmet ? '#ef4444' : '#eab308',
    fillColor: isSigmet ? '#ef4444' : '#eab308',
    fillOpacity: isSigmet ? 0.2 : 0.1,
    weight: isSigmet ? 2 : 1
  };
}

function getHazardIcon(subType: string): string {
  if (subType.includes('CONV') || subType.includes('TS')) return '⛈️';
  if (subType.includes('TURB')) return '🌊';
  if (subType.includes('ICE') || subType.includes('ICG')) return '🧊';
  if (subType.includes('IFR')) return '🌫️';
  if (subType.includes('MTN')) return '⛰️';
  return '⚠️';
}

function formatAlt(ft?: number): string {
  if (ft == null) return '--';
  if (ft >= 18000) return `FL${Math.round(ft / 100)}`;
  return `${ft.toLocaleString()}'`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch { return '--'; }
}

export default function SigmetLayer({ visible }: SigmetLayerProps) {
  const [sigmets, setSigmets] = useState<SigmetData[]>([]);
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const fetchSigmets = async () => {
      try {
        const response = await fetch('/api/sigmet?type=all');
        if (!response.ok) throw new Error('Failed');
        
        const data = await response.json();
        if (Array.isArray(data)) {
          setSigmets(data.filter((s: SigmetData) => s.coords.length >= 3 && s.isActive));
        }
      } catch (error) {
        console.error('SIGMET fetch error:', error);
      }
    };

    fetchSigmets();
    const interval = setInterval(fetchSigmets, 10 * 60 * 1000); // Every 10 min
    
    return () => clearInterval(interval);
  }, [visible, map]);

  if (!visible) return null;

  return (
    <>
      {sigmets.map((sigmet) => {
        const style = getSigmetStyle(sigmet);
        const positions = sigmet.coords.map(c => [c.lat, c.lng] as [number, number]);
        const icon = getHazardIcon(sigmet.subType);
        
        return (
          <Polygon
            key={sigmet.id}
            positions={positions}
            pathOptions={style}
          >
            <Popup>
              <div className="min-w-[220px] max-w-[300px]">
                <div className="font-bold text-sm mb-1">
                  {icon} {sigmet.type} — {sigmet.subType}
                </div>
                
                <div className="text-xs space-y-1">
                  <p className="font-medium">{sigmet.hazard}</p>
                  
                  <div className="border-t pt-1 mt-1">
                    <p><strong>Valid:</strong> {formatTime(sigmet.validFrom)}</p>
                    <p><strong>Until:</strong> {formatTime(sigmet.validTo)}</p>
                  </div>
                  
                  {(sigmet.altitudeLow != null || sigmet.altitudeHigh != null) && (
                    <p>
                      <strong>Altitude:</strong>{' '}
                      {formatAlt(sigmet.altitudeLow)} to {formatAlt(sigmet.altitudeHigh)}
                    </p>
                  )}
                  
                  <details className="border-t pt-1 mt-1">
                    <summary className="text-gray-500 cursor-pointer">Raw Text</summary>
                    <pre className="text-[10px] whitespace-pre-wrap mt-1">{sigmet.rawText}</pre>
                  </details>
                </div>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </>
  );
}
