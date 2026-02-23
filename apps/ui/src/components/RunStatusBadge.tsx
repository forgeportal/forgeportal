import type { RunStatus } from '../lib/types.js';
import Spinner from './Spinner.js';

const STATUS_STYLES: Record<RunStatus, string> = {
  queued:   'bg-gray-100 text-gray-700',
  running:  'bg-blue-100 text-blue-700',
  success:  'bg-green-100 text-green-700',
  failed:   'bg-red-100 text-red-700',
  canceled: 'bg-yellow-100 text-yellow-700',
};

const STATUS_LABELS: Record<RunStatus, string> = {
  queued:   'Queued',
  running:  'Running',
  success:  'Success',
  failed:   'Failed',
  canceled: 'Canceled',
};

export default function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status === 'running' && <Spinner size="xs" />}
      {STATUS_LABELS[status]}
    </span>
  );
}
