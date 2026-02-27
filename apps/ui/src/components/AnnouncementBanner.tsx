import { useState } from 'react';
import { useBranding } from '../hooks/useBranding.js';

const VARIANT_STYLES = {
  info:    'bg-blue-50  border-blue-200  text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error:   'bg-red-50   border-red-200   text-red-800',
} as const;

export function AnnouncementBanner() {
  const { announcement } = useBranding();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('fp-announcement-dismissed') === announcement?.message,
  );

  if (!announcement || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem('fp-announcement-dismissed', announcement.message);
    setDismissed(true);
  };

  return (
    <div
      className={`border-b px-4 py-2.5 flex items-center justify-between gap-4 text-sm ${VARIANT_STYLES[announcement.variant]}`}
      role="alert"
    >
      <span>{announcement.message}</span>
      <button
        onClick={dismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-base leading-none"
        aria-label="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  );
}
