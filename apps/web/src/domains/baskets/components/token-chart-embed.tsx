"use client";

interface Props {
  height?: number;
  poolAddress: string;
  symbol: string;
}

export function TokenChartEmbed({ poolAddress, symbol, height = 500 }: Props) {
  const src = `https://dexscreener.com/robinhood/${poolAddress}?embed=1&theme=dark&trades=0&info=0`;
  return (
    <div className="w-full" style={{ height }}>
      <iframe
        allow="clipboard-write"
        className="h-full w-full border-0"
        loading="lazy"
        src={src}
        title={`${symbol} chart`}
      />
    </div>
  );
}
