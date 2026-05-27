export default function LoadingSpinner({ text = 'Yükleniyor…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full animate-spin"
          style={{ border: '2px solid transparent', borderTopColor: '#7c3aed', borderRightColor: 'rgba(124,58,237,0.3)' }} />
        <div className="absolute inset-2 rounded-full animate-spin"
          style={{ border: '2px solid transparent', borderTopColor: '#2563eb', animationDirection: 'reverse', animationDuration: '0.7s' }} />
      </div>
      <p className="text-sm text-white/30 tracking-wide">{text}</p>
    </div>
  );
}

export function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-3.5 rounded-full animate-shimmer" style={{ width: i === 1 ? '60%' : '80%' }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full animate-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-full animate-shimmer w-2/3" />
          <div className="h-2.5 rounded-full animate-shimmer w-1/2" />
        </div>
        <div className="h-5 rounded-lg animate-shimmer w-16" />
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[1,2,3].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="h-2 rounded animate-shimmer w-3/4" />
            <div className="h-3 rounded animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
