interface PlaceholderTabProps {
  title: string;
}

export default function PlaceholderTab({ title }: PlaceholderTabProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="rounded-full bg-indigo-50 p-4">
        <svg
          className="h-8 w-8 text-indigo-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      </div>
      <h3 className="font-semibold text-gray-700">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        This feature is coming soon. Stay tuned for updates.
      </p>
    </div>
  );
}
