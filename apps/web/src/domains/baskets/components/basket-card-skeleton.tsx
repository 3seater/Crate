/**
 * Loading skeleton that mirrors the shape of BasketCard.
 * Requirements: 4.6, 10.1
 */
export function BasketCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Basket name */}
          <div
            className="h-4 w-32 bg-[color:var(--bg-surface-raised)]"
            data-slot="skeleton"
          />
          {/* Ticker/ID */}
          <div
            className="mt-1.5 h-3 w-20 bg-[color:var(--bg-surface-raised)]"
            data-slot="skeleton"
          />
        </div>

        {/* 24h performance pill */}
        <div
          className="h-4 w-14 shrink-0 bg-[color:var(--bg-surface-raised)]"
          data-slot="skeleton"
        />
      </div>

      {/* Constituent weights row */}
      <div
        className="h-3 w-48 bg-[color:var(--bg-surface-raised)]"
        data-slot="skeleton"
      />

      {/* Explorer link row */}
      <div
        className="h-3 w-28 bg-[color:var(--bg-surface-raised)]"
        data-slot="skeleton"
      />
    </div>
  );
}
