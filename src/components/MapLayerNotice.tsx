'use client';

import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';

interface MapLayerNoticeProps {
  message: string | null;
  title?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  tone?: 'amber' | 'red';
}

const POSITION_CLASS: Record<NonNullable<MapLayerNoticeProps['position']>, string> = {
  'top-left': 'top-3 left-3',
  'top-right': 'top-14 right-3',
  'bottom-left': 'bottom-3 left-3',
  'bottom-right': 'bottom-3 right-3',
}

const TONE_CLASS: Record<NonNullable<MapLayerNoticeProps['tone']>, string> = {
  amber: 'border-amber-500/50 bg-amber-950 text-amber-50',
  red: 'border-red-500/50 bg-red-950 text-red-50',
}

export default function MapLayerNotice({
  message,
  title = 'Layer unavailable',
  position = 'bottom-left',
  tone = 'amber',
}: MapLayerNoticeProps) {
  const map = useMap();
  // The Leaflet context already owns a mounted map container. Its parent is
  // derived from that context, not separately mirrored in React state.
  const host = map.getContainer().parentElement;
  const stack = host?.querySelector('[data-map-layer-notices]');

  if (!message || !host) {
    return null;
  }

  return createPortal(
    <div style={stack ? undefined : { maxWidth: 'min(320px, calc(100% - 5rem))' }} className={`shrink-0 rounded-xl border px-3 text-xs shadow-lg ${stack ? '' : `absolute z-[950] ${POSITION_CLASS[position]}`} ${TONE_CLASS[tone]}`} role="status" aria-live="polite">
      <details>
        <summary className="min-h-12 cursor-pointer py-3 leading-relaxed">
          <strong>{title}</strong> · {/incomplete/i.test(message) ? 'Incomplete' : /unavailable|unable|failed/i.test(message) ? 'Unavailable' : 'Limits'} — details
        </summary>
        <p className="pb-3 text-[11px] leading-relaxed">{message}</p>
      </details>
    </div>,
    stack || host
  );
}
