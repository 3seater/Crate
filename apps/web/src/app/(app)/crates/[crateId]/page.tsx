import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BASKETS, getBasketById } from "@/config/baskets";
import { BasketSelector } from "@/domains/baskets/components/basket-selector";
import { BasketTerminalClient } from "@/domains/baskets/components/basket-terminal-client";
import { OrderPanel } from "@/domains/baskets/components/order-panel";
import { WrongNetworkBanner } from "@/domains/baskets/components/wrong-network-banner";
import { createPageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return BASKETS.map((b) => ({ crateId: b.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ crateId: string }>;
}) {
  const { crateId } = await params;
  const crate = getBasketById(crateId);
  if (!crate) {
    return { title: "Not Found" };
  }
  return createPageMetadata({
    title: { absolute: `${crate.name} — Crate` },
    description: crate.description,
    openGraph: { title: `${crate.name} — Crate` },
  });
}

export default async function CrateTerminalPage({
  params,
}: {
  params: Promise<{ crateId: string }>;
}) {
  const { crateId } = await params;
  const crate = getBasketById(crateId);
  if (!crate) {
    notFound();
  }

  await connection();

  return (
    <div className="flex h-full min-h-0 max-w-[100vw] flex-col overflow-hidden lg:flex-row">
      {/* ── Left: chart + constituents ───────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <BasketSelector activeBasketId={crate.id} />

        <div>
          <h1
            className="text-[color:var(--text-primary)]"
            style={{
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontSize: "clamp(24px,3vw,48px)",
            }}
          >
            {crate.name}
          </h1>
          <p className="text-[color:var(--text-secondary)] text-sm">
            {crate.description}
          </p>
        </div>

        {/*
          BasketTerminalClient owns live price polling (every 30s).
          It renders ConstituentList + BasketChart and passes live prices
          to both, so images and prices always reflect the latest data
          regardless of whether SSR prefetch succeeded.
        */}
        <BasketTerminalClient constituents={crate.constituents} />
      </div>

      {/* ── Right: order panel ───────────────────────────────────────── */}
      <div className="flex w-full shrink-0 flex-col gap-3 border-[color:var(--border-default)] border-t p-4 lg:w-80 lg:overflow-y-auto lg:border-[color:var(--border-default)] lg:border-t-0 lg:border-l">
        <WrongNetworkBanner />
        <OrderPanel basketId={crate.id} constituents={crate.constituents} />
      </div>
    </div>
  );
}
