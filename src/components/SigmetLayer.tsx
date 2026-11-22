'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Polygon, Popup, useMap } from 'react-leaflet';

import MapLayerNotice from '@/components/MapLayerNotice';
import { isOverlayResponse } from '@/lib/overlay-response';
import { isRenderableSigmet, type SigmetData } from '@/lib/sigmet-normalize';

interface SigmetLayerProps {
  visible: boolean;
}

function getSigmetStyle(sigmet: SigmetData) {
  const isSigmet = sigmet.type === 'SIGMET';

  if (sigmet.subType.includes('CONV') || sigmet.subType.includes('TS')) {
    return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 2 };
  }
  if (sigmet.subType.includes('TURB')) {
    return { color: '#f97316', fillColor: '#f97316', fillOpacity: isSigmet ? 0.2 : 0.12, weight: isSigmet ? 2 : 1.5 };
  }
  if (sigmet.subType.includes('ICE') || sigmet.subType.includes('ICG')) {
    return { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: isSigmet ? 0.2 : 0.12, weight: isSigmet ? 2 : 1.5 };
  }
  if (sigmet.subType.includes('IFR') || /MTN|MT[_-]OB/.test(sigmet.subType)) {
    return { color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.12, weight: 1.5 };
  }

  return {
    color: isSigmet ? '#ef4444' : '#eab308',
    fillColor: isSigmet ? '#ef4444' : '#eab308',
    fillOpacity: isSigmet ? 0.2 : 0.1,
    weight: isSigmet ? 2 : 1,
  };
}

function getHazardIcon(subType: string): string {
  if (subType.includes('CONV') || subType.includes('TS')) return '⛈️';
  if (subType.includes('TURB')) return '🌊';
  if (subType.includes('ICE') || subType.includes('ICG')) return '🧊';
  if (subType.includes('IFR')) return '🌫️';
  if (/MTN|MT[_-]OB/.test(subType)) return '⛰️';
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
  } catch {
    return '--';
  }
}

export default function SigmetLayer({ visible }: SigmetLayerProps) {
  const [sigmets, setSigmets] = useState<SigmetData[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [selection, setSelection] = useState('current');
  const [now, setNow] = useState(() => Date.now());
  const map = useMap();

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const controller = new AbortController();

    const fetchSigmets = async () => {
      try {
        const response = await fetch('/api/sigmet?type=all', { signal: controller.signal });
        const data = await response.json();
        if (cancelled) return;

        const envelope = isOverlayResponse<unknown>(data) ? data : null;
        const items: unknown[] | null = envelope ? envelope.items : Array.isArray(data) && response.ok ? data : null;
        if (items && (!envelope || envelope.status === 'live' || envelope.status === 'unavailable')) {
          const valid = items.filter(isRenderableSigmet);
          setSigmets(valid);
          setNow(Date.now());
          const invalidNotice = valid.length !== items.length
            ? 'SIGMET/AIRMET coverage is incomplete: invalid reports were omitted. Cross-check with an official briefing source.' : null;
          const providerNotice = envelope?.message || (envelope?.status === 'unavailable' || !response.ok
            ? 'Live SIGMET/AIRMET data is unavailable right now. Cross-check with an official briefing source.' : null);
          setNotice([invalidNotice, providerNotice].filter(Boolean).join(' ') || null);
          return;
        }

        throw new Error('Unexpected SIGMET response shape');
      } catch (error) {
        if (cancelled) return;
        console.error('SIGMET fetch error:', error);
        setSigmets([]);
        setNotice('Unable to load live SIGMET/AIRMET data right now. Cross-check with an official briefing source.');
      }
    };

    void fetchSigmets();
    const interval = setInterval(() => void fetchSigmets(), 10 * 60 * 1000);
    // Expire polygons even if the next refresh has not happened yet.
    const clock = setInterval(() => setNow(Date.now()), 30000);

    return () => { cancelled = true; controller.abort(); clearInterval(interval); clearInterval(clock); };
  }, [visible, map]);

  if (!visible) return null;
  const available = sigmets.filter(item => item.timeKind !== 'snapshot' || (Date.parse(item.issuedAt!) <= now && now < Date.parse(item.productExpiresAt!)));
  const snapshots = [...new Set(available.filter(item => item.timeKind === 'snapshot').map(item => item.snapshotTime!))].sort();
  // An expired/removed selection returns to current products; never silently pick a different forecast time.
  const selected = selection === 'current' || selection === 'alaska' || snapshots.includes(selection) ? selection : 'current';
  const displayed = available.filter(item => selected === 'current'
    ? item.timeKind !== 'snapshot' && item.product !== 'Alaska AIRMET' && Date.parse(item.validFrom) <= now && now < Date.parse(item.validTo)
    : selected === 'alaska'
    ? item.product === 'Alaska AIRMET' && Date.parse(item.validFrom) <= now && now < Date.parse(item.validTo)
    : item.timeKind === 'snapshot' && item.snapshotTime === selected);
  const host = map.getContainer().parentElement;

  return (
    <>
      {host && createPortal(
        <section aria-label="Hazard product time" className="absolute top-14 right-3 z-[950] rounded-xl border border-slate-600 bg-slate-950 p-3 text-xs text-white shadow-lg" style={{ width: 'min(300px, calc(100% - 5rem))' }}>
          <label className="block font-semibold" htmlFor="hazard-product-time">Hazard product time (UTC)</label>
          <select id="hazard-product-time" className="mt-2 min-h-11 w-full rounded border border-slate-500 bg-slate-900 px-2 text-xs" value={selected} onChange={event => setSelection(event.target.value)}>
            <option value="current">Current SIGMET</option>
            <option value="alaska">Alaska AIRMET forecast zones</option>
            {snapshots.map(time => <option key={time} value={time}>G-AIRMET: {formatTime(time)}</option>)}
          </select>
          <p className="mt-2 leading-relaxed">{selected === 'current'
            ? 'Current SIGMET only. Choose another view for advisories.'
            : selected === 'alaska'
            ? 'Alaska forecast product periods only. Zone outlines are not precise hazard boundaries; local timing and altitude require the official forecast. SIGMETs hidden.'
            : `G-AIRMET snapshot only: ${formatTime(selected)}. Not continuous validity. Current SIGMET / Alaska layers hidden.`}</p>
          {!displayed.length && <p className="mt-1">No polygons available for this view; this is not an all-clear.</p>}
          {!snapshots.length && <p className="mt-1">No unexpired G-AIRMET snapshots available.</p>}
        </section>, host)}
      <MapLayerNotice message={notice} title="Hazard coverage" position="bottom-right" tone="amber" />
      {displayed.map((sigmet) => {
        const style = getSigmetStyle(sigmet);
        const positions = sigmet.coords.map((coord) => [coord.lat, coord.lng] as [number, number]);
        const icon = getHazardIcon(sigmet.subType);

        return (
          <Polygon key={sigmet.id} positions={positions} pathOptions={style}>
            <Popup>
              <div className="min-w-[220px] max-w-[300px]">
                <div className="font-bold text-sm mb-1">
                  {icon} {sigmet.product ?? sigmet.type} — {sigmet.subType}
                </div>

                <div className="text-xs space-y-1">
                  <p className="font-medium">{sigmet.hazard}</p>

                  <div className="border-t pt-1 mt-1">
                    {sigmet.timeKind === 'snapshot' ? <>
                      <p><strong>Forecast snapshot:</strong> {formatTime(sigmet.snapshotTime!)}</p>
                      <p>Valid at this instant only — not an hours-long period.</p>
                      <p><strong>Issued:</strong> {formatTime(sigmet.issuedAt!)}</p>
                      <p><strong>Product expires:</strong> {formatTime(sigmet.productExpiresAt!)} (not hazard validity)</p>
                    </> : <>
                      <p><strong>{sigmet.product === 'Alaska AIRMET' ? 'Product from:' : 'Valid:'}</strong> {formatTime(sigmet.validFrom)}</p>
                      <p><strong>Until:</strong> {formatTime(sigmet.validTo)}</p>
                    </>}
                    {sigmet.product === 'Alaska AIRMET' && <p>{sigmet.zone}: forecast-zone outline, not a precise hazard boundary. Local timing and extent require the official Alaska forecast.</p>}
                  </div>

                  {sigmet.altitudeDescription ? <p><strong>Altitude:</strong> {sigmet.altitudeDescription}</p> : (sigmet.altitudeLow != null || sigmet.altitudeHigh != null) && (
                    <p>
                      <strong>Altitude:</strong> {formatAlt(sigmet.altitudeLow)} to {formatAlt(sigmet.altitudeHigh)}
                    </p>
                  )}

                  <details className="border-t pt-1 mt-1">
                    <summary className="text-gray-500 cursor-pointer">{sigmet.product ? 'Provider details' : 'Raw Text'}</summary>
                    <pre className="text-[10px] whitespace-pre-wrap break-words mt-1">{sigmet.rawText || 'No text supplied.'}</pre>
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
