import './ui.css'

export default function Skeleton({ height = 16, width = '100%', className = '' }) {
  return (
    <div
      className={`ui-skeleton ${className}`.trim()}
      style={{ height, width }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-card" key={i}>
          <Skeleton height={14} width="40%" />
          <Skeleton height={28} width="55%" className="mt-3" />
          <Skeleton height={12} width="70%" className="mt-3" />
        </div>
      ))}
    </div>
  )
}
