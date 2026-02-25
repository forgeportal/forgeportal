import React from 'react';

interface PodStatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  Running:           'bg-green-100 text-green-800',
  Succeeded:         'bg-green-100 text-green-800',
  Completed:         'bg-green-100 text-green-800',
  Pending:           'bg-yellow-100 text-yellow-800',
  Terminating:       'bg-yellow-100 text-yellow-800',
  Init:              'bg-yellow-100 text-yellow-800',
  CrashLoopBackOff:  'bg-red-100   text-red-800',
  Error:             'bg-red-100   text-red-800',
  OOMKilled:         'bg-red-100   text-red-800',
  Failed:            'bg-red-100   text-red-800',
  ImagePullBackOff:  'bg-red-100   text-red-800',
  Unknown:           'bg-gray-100  text-gray-600',
};

export function PodStatusBadge({ status }: PodStatusBadgeProps): React.ReactElement {
  const key = Object.keys(STATUS_STYLES).find((k) =>
    status.toLowerCase().includes(k.toLowerCase()),
  ) ?? 'Unknown';

  const cls = STATUS_STYLES[key] ?? STATUS_STYLES['Unknown'];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}
