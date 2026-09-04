import Image from "next/image";
import { cn } from "@/utils/cn";

export interface TopToken {
  address: string;
  change24h: number | null;
  dexId: string;
  imageUrl: string | null;
  liquidity: number;
  marketCap: number;
  name: string;
  poolAddress: string;
  priceUsd: number;
  symbol: string;
  volume24h: number;
}

interface TokensTableProps {
  tokens: TopToken[];
}

function fmt(n: number, prefix = "") {
  if (n >= 1_000_000_000) {
    return `${prefix}${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${prefix}${(n / 1000).toFixed(1)}K`;
  }
  return `${prefix}${n.toFixed(2)}`;
}

function formatPrice(p: number): string {
  if (p < 0.0001) {
    return `$${p.toExponential(2)}`;
  }
  if (p < 1) {
    return `$${p.toPrecision(4)}`;
  }
  return `$${p.toFixed(2)}`;
}

export function TokensTable({ tokens }: TokensTableProps) {
  if (tokens.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-text-muted">
        No tokens found. The server may be starting up.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border border-b bg-muted/30">
            <th className="py-2 pl-4 text-left font-medium text-text-muted text-xs">
              #
            </th>
            <th className="px-3 py-2 text-left font-medium text-text-muted text-xs">
              Token
            </th>
            <th className="px-3 py-2 text-right font-medium text-text-muted text-xs">
              Price
            </th>
            <th className="px-3 py-2 text-right font-medium text-text-muted text-xs">
              24h
            </th>
            <th className="px-3 py-2 text-right font-medium text-text-muted text-xs">
              Market Cap
            </th>
            <th className="px-3 py-2 pr-4 text-right font-medium text-text-muted text-xs">
              Vol 24h
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => {
            const isPositive = token.change24h != null && token.change24h >= 0;
            let changeClass = "text-text-muted";
            if (token.change24h != null) {
              changeClass = isPositive ? "text-positive" : "text-destructive";
            }

            return (
              <tr
                className="border-border/50 border-b transition-colors last:border-0 hover:bg-muted/20"
                key={token.address}
              >
                <td className="py-2.5 pl-4 text-text-muted text-xs tabular-nums">
                  {i + 1}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {token.imageUrl ? (
                      <Image
                        alt={token.symbol}
                        className="size-7 rounded-full object-cover"
                        height={28}
                        src={token.imageUrl}
                        unoptimized
                        width={28}
                      />
                    ) : (
                      <div className="flex size-7 items-center justify-center rounded-full bg-muted font-medium text-[10px] text-text-muted">
                        {token.symbol.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-text-primary">
                        {token.symbol}
                      </p>
                      <p className="text-text-muted text-xs">{token.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-text-primary tabular-nums">
                  {formatPrice(token.priceUsd)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2.5 text-right text-xs tabular-nums",
                    changeClass
                  )}
                >
                  {token.change24h == null
                    ? "—"
                    : `${isPositive ? "+" : ""}${token.change24h.toFixed(2)}%`}
                </td>
                <td className="px-3 py-2.5 text-right text-text-primary tabular-nums">
                  {fmt(token.marketCap, "$")}
                </td>
                <td className="px-3 py-2.5 pr-4 text-right text-text-secondary tabular-nums">
                  {fmt(token.volume24h, "$")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
