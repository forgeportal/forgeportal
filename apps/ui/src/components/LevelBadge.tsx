const LEVEL_CONFIG: Record<string, { label: string; classes: string; icon: string }> = {
  Gold:    { label: 'Gold',          classes: 'bg-yellow-100 text-yellow-800 border border-yellow-300', icon: '🥇' },
  Silver:  { label: 'Silver',        classes: 'bg-gray-100  text-gray-700  border border-gray-300',    icon: '🥈' },
  Bronze:  { label: 'Bronze',        classes: 'bg-orange-100 text-orange-700 border border-orange-300', icon: '🥉' },
  pending: { label: 'Pending',       classes: 'bg-gray-50   text-gray-400  border border-gray-200',    icon: '⏳' },
  none:    { label: 'Not evaluated', classes: 'bg-red-50    text-red-500   border border-red-200',     icon: '–' },
};

export default function LevelBadge({ level }: { level: string | null }) {
  const key = level ?? 'none';
  const cfg = LEVEL_CONFIG[key] ?? LEVEL_CONFIG['none']!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${cfg.classes}`}>
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
