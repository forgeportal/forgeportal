import clsx from 'clsx';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  xs: 'h-3 w-3 border-2',
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

export default function Spinner({ size = 'md' }: SpinnerProps) {
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-gray-200 border-t-indigo-500',
        sizeClasses[size],
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
