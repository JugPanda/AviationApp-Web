'use client';

import { containDialogTab } from '@/lib/dialog-focus';

import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal: browser-owned focus containment, Escape and restoration. */
export default function WorkspaceDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog onKeyDown={containDialogTab} ref={ref} className="av-map-panel" aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="av-map-panel-inner">
      <header><div><p className="av-eyebrow">Weather workspace</p><h2>{title}</h2></div><button type="button" onClick={onClose} autoFocus aria-label={`Close ${title.toLowerCase()}`}>Close ×</button></header>
      <div className="av-map-panel-body">{children}</div>
    </div>
  </dialog>;
}
