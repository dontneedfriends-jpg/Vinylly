export function ImportProgress({
  done,
  total,
  className = '',
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div
      className={className}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="import"
    >
      <div className="bg-surface shadow-neu-inset rounded-base h-1.5 w-full overflow-hidden border border-border-default">
        <div
          className="bg-fg-brand h-full transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-fg-body-subtle mt-1 text-[11px] tabular-nums">
        {done} / {total} · {pct}%
      </div>
    </div>
  );
}
