export default function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 w-40 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-16 rounded-full bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-28 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-20 rounded-full bg-gray-200" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <div className="h-5 w-12 rounded-full bg-gray-200" />
          <div className="h-5 w-10 rounded-full bg-gray-200" />
        </div>
      </td>
    </tr>
  );
}
