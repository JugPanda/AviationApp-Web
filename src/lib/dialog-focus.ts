import type { KeyboardEvent } from 'react';

/** Keep Tab navigation within an open modal, including at browser-chrome edges. */
export function containDialogTab(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget;
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]'))
    .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0);
  if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
}
