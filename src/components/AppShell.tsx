'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import '@/app/workspace.css';

// Use the server snapshot through hydration before revealing browser-local data.
const subscribeToHydration = () => () => {};
export function useBrowserReady() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

const destinations = [
  { href: '/map', label: 'Weather map', shortLabel: 'Weather', index: '01' },
  { href: '/plan', label: 'Flight planning', shortLabel: 'Planning', index: '02' },
  { href: '/tools', label: 'Pilot tools', shortLabel: 'Tools', index: '03' },
  { href: '/logbook', label: 'Flight logbook', shortLabel: 'Logbook', index: '04' },
];

export default function AppShell({ children, map = false }: { children: ReactNode; map?: boolean }) {
  const pathname = usePathname();

  return (
    <div className={`av-workspace${map ? ' av-workspace--map' : ''}`}>
      <a href="#workspace-content" className="av-skip-link">Skip to workspace</a>
      <header className="av-shell-header">
        <div className="av-shell-bar">
          <Link prefetch={false} href="/" className="av-brand" aria-label="AV Weather Pilot workspace — back to home">
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2" stroke="currentColor" strokeLinecap="round" />
              <polygon points="12,4 14,16 12,14 10,16" fill="currentColor" />
              <polygon points="12,10 18,13 18,14 12,12" fill="currentColor" />
              <polygon points="12,10 6,13 6,14 12,12" fill="currentColor" />
            </svg>
            <span>AV Weather<span className="av-brand-caption">Pilot workspace</span></span>
          </Link>
          <nav className="av-primary-nav" aria-label="Workspace navigation">
            {destinations.map(({ href, label, shortLabel, index }) => (
              <Link prefetch={false} key={href} href={href} aria-label={label} aria-current={pathname === href ? 'page' : undefined}>
                <span className="av-nav-index" aria-hidden="true">{index}</span>
                {shortLabel}
              </Link>
            ))}
          </nav>
          <Link prefetch={false} href="/" className="av-home-link">Home <span aria-hidden="true">↗</span></Link>
        </div>
        <details className="av-preview-notice">
          <summary><span className="av-preview-label">Preview</span><span>Supplemental use only</span><span className="av-notice-more">Read notice</span></summary>
          <p>Not a substitute for an official preflight briefing, approved aircraft documentation, or required records. Verify data freshness, calculations, and operating requirements independently. Saved plans, logbook entries, and aircraft profiles stay in this browser; they do not sync across devices. Use the export controls in Planning, Logbook, and Weight &amp; Balance to keep separate backups.</p>
        </details>
      </header>
      {children}
    </div>
  );
}
