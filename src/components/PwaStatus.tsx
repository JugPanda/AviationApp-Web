'use client';

import { useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaStatusProps {
  compact?: boolean;
}

export default function PwaStatus({ compact = false }: PwaStatusProps) {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.navigator.onLine;
  });
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(display-mode: standalone)').matches;
  });
  const [canInstall, setCanInstall] = useState(false);
  const [isCacheReady, setIsCacheReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setInstallEvent(null);
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setIsCacheReady(true))
        .catch(() => setIsCacheReady(false));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!isOnline) {
      return isCacheReady ? 'Offline-ready cache' : 'Offline';
    }

    if (isCacheReady) {
      return 'Installable offline shell';
    }

    return 'Live data';
  }, [isCacheReady, isOnline]);

  const handleInstall = async () => {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setCanInstall(false);
      setInstallEvent(null);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'pt-2'}`}>
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        isOnline
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}>
        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {statusLabel}
      </span>

      {canInstall && !isInstalled && (
        <button
          onClick={() => void handleInstall()}
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-100 transition-colors hover:bg-blue-500/20"
        >
          <span>⬇</span>
          Install app
        </button>
      )}

      {!isOnline && (
        <span className="text-xs text-slate-400">
          Cached screens stay available, but live METAR / ADS-B / NOTAM data still need a connection.
        </span>
      )}
    </div>
  );
}
