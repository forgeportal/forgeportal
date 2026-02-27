import clsx from 'clsx';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'kind' | 'lifecycle' | 'tag';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default:   'bg-gray-100   text-gray-700   dark:bg-gray-700   dark:text-gray-300',
  kind:      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  lifecycle: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  tag:       'bg-sky-100    text-sky-700    dark:bg-sky-900    dark:text-sky-300',
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
