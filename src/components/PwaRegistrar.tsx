'use client';

import { useEffect } from 'react';

export default function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('Failed to register service worker', error);
      }
    };

    void register();
  }, []);

  return null;
}
