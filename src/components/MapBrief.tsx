interface MapBriefProps {
  scopeLabel: string;
  visibleCount: number;
  totalCount: number;
  activeLayerCount: number;
  trackedFlightLabel: string | null;
  lastUpdated: Date | null;
  flightsLoading?: boolean;
}

function formatRelativeTime(lastUpdated: Date | null): string {
  if (!lastUpdated) {
    return 'Waiting for weather';
  }

  const seconds = Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000));
  if (seconds < 60) {
    return 'Updated just now';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
}

export default function MapBrief({
  scopeLabel,
  visibleCount,
  totalCount,
  activeLayerCount,
  trackedFlightLabel,
  lastUpdated,
  flightsLoading = false,
}: MapBriefProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <BriefChip label="Scope" value={scopeLabel} />
      <BriefChip label="Airports" value={`${visibleCount}/${totalCount}`} />
      <BriefChip label="Weather" value={formatRelativeTime(lastUpdated)} />
      <BriefChip label="Layers" value={activeLayerCount > 0 ? `${activeLayerCount} active` : 'Map only'} />
      {(trackedFlightLabel || flightsLoading) && (
        <BriefChip label="Flights" value={flightsLoading ? 'Refreshing live track' : trackedFlightLabel ?? 'Enabled'} accent="amber" />
      )}
    </div>
  );
}

function BriefChip({
  label,
  value,
  accent = 'slate',
}: {
  label: string;
  value: string;
  accent?: 'slate' | 'amber';
}) {
  const accentClass = accent === 'amber'
    ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
    : 'border-slate-700 bg-slate-800/80 text-slate-200';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${accentClass}`}>
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-current">{value}</span>
    </div>
  );
}
