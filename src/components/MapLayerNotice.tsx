'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';

interface MapLayerNoticeProps {
  message: string | null;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  tone?: 'amber' | 'red';
}

const POSITION_CLASS: Record<NonNullable<MapLayerNoticeProps['position']>, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-3 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
}

const TONE_CLASS: Record<NonNullable<MapLayerNoticeProps['tone']>, string> = {
  amber: 'border-amber-500/50 bg-amber-500/15 text-amber-50',
  red: 'border-red-500/50 bg-red-500/15 text-red-50',
}

export default function MapLayerNotice({
  message,
  position = 'bottom-left',
  tone = 'amber',
}: MapLayerNoticeProps) {
  const map = useMap();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(map.getContainer().parentElement);
  }, [map]);

  if (!message || !host) {
    return null;
  }

  return createPortal(
    <div className={`pointer-events-none absolute z-[950] max-w-[320px] rounded-2xl border px-3 py-2 text-xs shadow-lg backdrop-blur-sm ${POSITION_CLASS[position]} ${TONE_CLASS[tone]}`} role="status" aria-live="polite">
      <div className="font-semibold">Layer unavailable</div>
      <div className="mt-1 text-[11px] leading-relaxed text-current/90">{message}</div>
    </div>,
    host
  );
}
