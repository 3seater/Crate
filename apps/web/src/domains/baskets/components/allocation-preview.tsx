import type { AllocationLine } from "@/domains/baskets/lib/allocation";
import { formatUsdCompact } from "@/utils/format";

interface AllocationPreviewProps {
  lines: AllocationLine[];
}

/** Renders a basket deposit allocation breakdown table (Server Component). */
export function AllocationPreview({ lines }: AllocationPreviewProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-[color:var(--border-subtle)] border-b">
            <th className="pb-2 text-left font-medium text-text-muted text-xs">
              Symbol
            </th>
            <th className="pb-2 text-right font-medium text-text-muted text-xs">
              Weight
            </th>
            <th className="pb-2 text-right font-medium text-text-muted text-xs">
              ETH Amount
            </th>
            <th className="pb-2 text-right font-medium text-text-muted text-xs">
              USD Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              className="border-[color:var(--border-subtle)] border-b last:border-0"
              key={line.address}
            >
              <td className="py-2 text-left font-medium text-[color:var(--crate-orange)] text-sm">
                {line.symbol}
              </td>
              <td className="py-2 text-right text-sm text-text-primary">
                {Math.round(line.weight * 100)}%
              </td>
              <td className="py-2 text-right font-mono text-sm text-text-primary">
                {line.ethAmount.toFixed(4)}
              </td>
              <td className="py-2 text-right text-sm text-text-primary">
                {line.usdAmount == null ? (
                  <span className="text-[color:var(--text-tertiary)]">—</span>
                ) : (
                  formatUsdCompact(line.usdAmount, { compact: false })
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
