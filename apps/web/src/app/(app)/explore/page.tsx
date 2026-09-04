import { connection } from "next/server";
import { Suspense } from "react";
import type { TopToken } from "@/domains/tokens/components/tokens-table";
import { TokensTable } from "@/domains/tokens/components/tokens-table";
import { createPageMetadata } from "@/lib/seo";
import { serverTrpc } from "@/lib/trpc/server";
import { ContentSpacing } from "@/shell/content-spacing";
import { ContentWidth } from "@/shell/content-width";

export const metadata = createPageMetadata({
  title: "Explore",
  description: "Top meme tokens on Robinhood Chain by market cap",
});

export default async function ExplorePage() {
  await connection();

  let tokens: TopToken[] = [];
  try {
    const result = await serverTrpc.tokens.topTokens.query({ limit: 50 });
    tokens = result.tokens as TopToken[];
  } catch {
    // degrade gracefully — table renders empty state
  }

  return (
    <ContentWidth variant="wide">
      <ContentSpacing>
        <h1 className="font-medium text-2xl text-text-primary">Explore</h1>
        <p className="text-sm text-text-secondary">
          Top tokens on Robinhood Chain by market cap
        </p>
        <Suspense
          fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}
        >
          <TokensTable tokens={tokens} />
        </Suspense>
      </ContentSpacing>
    </ContentWidth>
  );
}
