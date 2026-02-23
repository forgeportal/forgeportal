import clsx from 'clsx';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'kind' | 'lifecycle' | 'tag';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-gray-100 text-gray-700',
  kind: 'bg-indigo-100 text-indigo-700',
  lifecycle: 'bg-emerald-100 text-emerald-700',
  tag: 'bg-sky-100 text-sky-700',
};

export default function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
      )}
    >
      {label}
    </span>
  );
}
