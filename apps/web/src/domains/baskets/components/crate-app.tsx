"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { BASKETS } from "@/config/baskets";
import { useBasketBuy } from "@/domains/baskets/hooks/use-basket-buy";
import { useBasketPrices } from "@/domains/baskets/hooks/use-basket-prices";
import { useEthPrice } from "@/domains/baskets/hooks/use-eth-price";
import { SiteNav } from "@/domains/baskets/components/site-nav";
import { ScrollProgress } from "@/domains/baskets/components/scroll-progress";
import { formatUsdCompact } from "@/utils/format";

// ─── Price formatting ─────────────────────────────────────────────────────────

/**
 * Formats a token price cleanly across the full range:
 * ≥ $1000 → $1.2K | ≥ $1 → $1.24 | ≥ $0.01 → $0.0124
 * ≥ $0.0001 → $0.000124 | < $0.0001 → up to 8 sig figs, no exponential
 */
function formatTokenPrice(priceUsd: number): string {
  if (priceUsd === 0) {
    return "$0";
  }
  if (priceUsd >= 1000) {
    return formatUsdCompact(priceUsd);
  }
  if (priceUsd >= 1) {
    return `$${priceUsd.toFixed(2)}`;
  }
  if (priceUsd >= 0.01) {
    return `$${priceUsd.toFixed(4)}`;
  }
  if (priceUsd >= 0.0001) {
    return `$${priceUsd.toFixed(6)}`;
  }
  return `$${Number(priceUsd.toPrecision(4)).toString()}`;
}

const TOKEN_COLOURS = [
  "#d4b2ff",
  "#f0a56a",
  "#8c7bb5",
  "#b9a4c9",
  "#f0b2c9",
  "#caa5f5",
  "#8d779e",
  "#e3cfda",
  "#d7c3f1",
  "#e4b4c9",
  "#927fa9",
  "#b8a7c3",
];

const ORB_COLOURS = ["#f0a56a", "#f6bd86", "#d8a878"];
const CATEGORIES = ["Core", "AI & Infra", "Cats"];

export const crates = BASKETS.map((basket, bi) => ({
  id: basket.id,
  name: basket.name,
  ticker: basket.id.replace(/-/g, "").toUpperCase().slice(0, 8),
  description: basket.description,
  category: CATEGORIES[bi] ?? "Core",
  color: ORB_COLOURS[bi % ORB_COLOURS.length] ?? "#f0a56a",
  constituents: basket.constituents,
  tokens: basket.constituents.map((c, ci) => ({
    symbol: c.symbol,
    address: c.address,
    poolAddress: c.poolAddress,
    logoUrl: c.logoUrl,
    weight: Math.round(c.weight * 100),
    rawWeight: c.weight,
    color: TOKEN_COLOURS[ci % TOKEN_COLOURS.length] ?? "#d4b2ff",
  })),
}));

export type CrateData = (typeof crates)[number];

export type PriceMap = Record<
  string,
  {
    priceUsd: number;
    change24h: number | null;
    imageUrl?: string | null;
  }
>;

const ALL_POOL_ADDRESSES = BASKETS.flatMap((b) =>
  b.constituents.map((c) => c.poolAddress)
);

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {
  /* no-op */
};

function Mark() {
  return (
    <Image
      alt="Crate"
      className="crate-logo"
      height={27}
      src="/crate-logo.svg"
      unoptimized
      width={27}
    />
  );
}

/** Token orb: shows real image if available, falls back to coloured initials */
function TokenOrb({
  imageUrl,
  symbol,
  color,
  size,
  className,
  style,
}: {
  imageUrl?: string | null;
  symbol: string;
  color: string;
  size: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [errored, setErrored] = useState(false);
  if (imageUrl && !errored) {
    return (
      <Image
        alt={symbol}
        className={`token-orb-img ${className ?? ""}`}
        height={size}
        onError={() => setErrored(true)}
        src={imageUrl}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          ...style,
        }}
        unoptimized
        width={size}
      />
    );
  }
  return (
    <div
      className={`crate-orb ${className ?? ""}`}
      style={{ "--orb": color, ...style } as React.CSSProperties}
    >
      <span>{symbol.slice(0, 2)}</span>
    </div>
  );
}

export function CrateCard({
  crate,
  priceMap = {},
  onSelect = noop,
}: {
  crate: CrateData;
  priceMap?: PriceMap;
  onSelect?: (crate: CrateData) => void;
}) {
  // Use the first token's image for the orb if available
  const firstToken = crate.tokens[0];
  const firstPrice = firstToken
    ? priceMap[firstToken.poolAddress.toLowerCase()]
    : undefined;

  // Average 24h change across tokens that have data
  const changes = crate.tokens
    .map((t) => priceMap[t.poolAddress.toLowerCase()]?.change24h)
    .filter((c): c is number => c != null);
  const avgChange =
    changes.length > 0
      ? changes.reduce((a, b) => a + b, 0) / changes.length
      : null;

  return (
    <article className="crate-card">
      <div className="crate-topline">
        <span className="eyebrow">{crate.category}</span>
        <span className="live-dot">Live</span>
      </div>
      <div className="crate-card-heading">
        <div>
          <h3>{crate.name}</h3>
        </div>
        <TokenOrb
          className="crate-orb"
          color={crate.color}
          imageUrl={firstPrice?.imageUrl ?? firstToken?.logoUrl}
          size={68}
          symbol={firstToken?.symbol ?? ""}
        />
      </div>
      <p className="crate-desc">{crate.description}</p>
      <div className="allocation-row">
        {crate.tokens.map((token) => (
          <div
            key={token.symbol}
            style={{ width: `${token.weight}%`, background: token.color }}
          />
        ))}
      </div>
      <div className="token-list">
        {crate.tokens.map((token) => (
          <span key={token.symbol}>
            {token.symbol} <b>{token.weight}%</b>
          </span>
        ))}
      </div>
      <div className="crate-footer">
        {avgChange == null ? (
          <span className="change">
            — <small>24h</small>
          </span>
        ) : (
          <span
            className="change"
            style={{ color: avgChange >= 0 ? "#9bdbb8" : "#f0a56a" }}
          >
            {avgChange >= 0 ? "+" : ""}
            {avgChange.toFixed(2)}% <small>24h</small>
          </span>
        )}
        <button
          className="ghost-button"
          onClick={() => onSelect(crate)}
          type="button"
        >
          Open crate
        </button>
      </div>
    </article>
  );
}

export function BuyModal({
  crate,
  priceMap = {},
  ethPriceUsd,
  isConnected,
  onClose,
}: {
  crate: CrateData;
  priceMap?: PriceMap;
  ethPriceUsd?: number;
  isConnected: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("0.1");
  const { openConnectModal } = useConnectModal();

  const { buy, buyState, reset } = useBasketBuy({
    basketId: crate.id,
    constituents: crate.constituents,
  });

  useEffect(() => {
    // Close on Escape
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Auto-close 2s after confirmed
  useEffect(() => {
    if (buyState.status === "confirmed") {
      const t = setTimeout(onClose, 2500);
      return () => clearTimeout(t);
    }
  }, [buyState.status, onClose]);

  const isBusy =
    buyState.status === "building" ||
    buyState.status === "confirming" ||
    buyState.status === "pending";

  let buttonLabel = "Connect wallet to continue";
  if (buyState.status === "confirmed") {
    buttonLabel = "✓ Transaction confirmed";
  } else if (buyState.status === "error") {
    buttonLabel = "Try again";
  } else if (buyState.status === "building") {
    buttonLabel = "Building bundle…";
  } else if (buyState.status === "confirming") {
    buttonLabel = "Confirm in wallet…";
  } else if (buyState.status === "pending") {
    buttonLabel = "Awaiting confirmation…";
  } else if (isConnected) {
    buttonLabel = "Buy crate";
  }

  const handleConfirm = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (buyState.status === "error") {
      reset();
      return;
    }
    if (buyState.status === "confirmed") {
      reset();
      return;
    }
    const amountNum = Number.parseFloat(amount) || 0;
    if (amountNum <= 0) {
      return;
    }
    await buy(amount);
  };

  const amountNum = Number.parseFloat(amount) || 0;
  const firstToken = crate.tokens[0];
  const firstPrice = firstToken
    ? priceMap[firstToken.poolAddress.toLowerCase()]
    : undefined;

  return (
    <div
      aria-label={`Buy ${crate.name}`}
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
    >
      <div className="buy-modal">
        <button
          aria-label="Close"
          className="modal-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        <div className="buy-heading">
          <div>
            <h2>{crate.name}</h2>
          </div>
          <TokenOrb
            className="large"
            color={crate.color}
            imageUrl={firstPrice?.imageUrl ?? firstToken?.logoUrl}
            size={86}
            symbol={firstToken?.symbol ?? ""}
          />
        </div>
        <div className="buy-amount">
          <label htmlFor="buy-amount-input">Amount to allocate (ETH)</label>
          <div>
            <span>Ξ</span>
            <input
              id="buy-amount-input"
              inputMode="decimal"
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
              value={amount}
            />
            {ethPriceUsd != null && amountNum > 0 && (
              <span className="buy-amount-usd">
                ≈&nbsp;$
                {(amountNum * ethPriceUsd).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
        </div>
        <div className="buy-breakdown">
          {crate.tokens.map((token) => {
            const price = priceMap[token.poolAddress.toLowerCase()];
            const ethAmt = (amountNum * token.weight) / 100;
            const usdAmt = ethPriceUsd == null ? null : ethAmt * ethPriceUsd;
            return (
              <div key={token.symbol}>
                <span>
                  <TokenOrb
                    color={token.color}
                    imageUrl={price?.imageUrl ?? token.logoUrl}
                    size={26}
                    symbol={token.symbol}
                    style={{
                      marginRight: 8,
                      verticalAlign: "middle",
                      display: "inline-block",
                    }}
                  />
                  {token.symbol}
                  {price && (
                    <small
                      style={{
                        marginLeft: 6,
                        color: "var(--muted)",
                        fontSize: 10,
                      }}
                    >
                      {formatTokenPrice(price.priceUsd)}
                    </small>
                  )}
                </span>
                <b>
                  {token.weight}%
                  {usdAmt == null ? (
                    <> · Ξ{ethAmt.toFixed(4)}</>
                  ) : (
                    <>
                      {" "}
                      ·{" "}
                      <span style={{ opacity: 0.5 }}>${usdAmt.toFixed(2)}</span>{" "}
                      · Ξ{ethAmt.toFixed(4)}
                    </>
                  )}{" "}
                </b>
              </div>
            );
          })}
        </div>

        {buyState.status === "error" && (
          <p
            style={{
              fontSize: 12,
              color: "var(--orange)",
              margin: "0 0 12px",
              padding: "8px 10px",
              background: "rgba(240,165,106,.08)",
              border: "1px solid rgba(240,165,106,.2)",
              wordBreak: "break-word",
            }}
          >
            {/* Trim raw calldata / long hex strings from wallet error messages */}
            {buyState.error
              .replace(/0x[0-9a-fA-F]{40,}/g, (m) => `${m.slice(0, 10)}…`)
              .slice(0, 120)}
          </p>
        )}

        {isBusy && (
          <div className="buy-loading-state">
            <div className="buy-loading-steps">
              <div
                className={`buy-loading-step ${buyState.status === "building" || buyState.status === "confirming" || buyState.status === "pending" ? "active" : ""} ${buyState.status === "confirming" || buyState.status === "pending" ? "done" : ""}`}
              >
                <span className="buy-loading-step-dot" />
                <span>Building bundle</span>
              </div>
              <div className="buy-loading-step-line" />
              <div
                className={`buy-loading-step ${buyState.status === "confirming" || buyState.status === "pending" ? "active" : ""} ${buyState.status === "pending" ? "done" : ""}`}
              >
                <span className="buy-loading-step-dot" />
                <span>Sign in wallet</span>
              </div>
              <div className="buy-loading-step-line" />
              <div
                className={`buy-loading-step ${buyState.status === "pending" ? "active" : ""}`}
              >
                <span className="buy-loading-step-dot" />
                <span>Confirming</span>
              </div>
            </div>
            <div className="buy-loading-bar">
              <div
                className={`buy-loading-bar-fill buy-loading-bar-${buyState.status}`}
              />
            </div>
          </div>
        )}

        <button
          className="primary-button full"
          disabled={isBusy || (isConnected && amountNum <= 0)}
          onClick={handleConfirm}
          type="button"
        >
          {isBusy ? <span className="buy-spinner" /> : buttonLabel}
        </button>

        {buyState.status === "confirmed" && buyState.txHash && (
          <p className="success-note">
            <a
              href={`https://robinhoodchain.blockscout.com/tx/${buyState.txHash}`}
              rel="noopener noreferrer"
              style={{ color: "#9bdbb8" }}
              target="_blank"
            >
              View on explorer ↗
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export default function CrateApp() {
  const { isConnected } = useAccount();
  const [selected, setSelected] = useState<CrateData | null>(null);

  const { data: priceData } = useBasketPrices(ALL_POOL_ADDRESSES);
  const ethPriceUsd = useEthPrice();

  const priceMap = useMemo<PriceMap>(() => {
    const map: PriceMap = {};
    for (const p of priceData?.prices ?? []) {
      // lowercase key so lookup always matches regardless of casing
      map[p.address.toLowerCase()] = {
        priceUsd: p.priceUsd,
        change24h: p.change24h,
        imageUrl: p.imageUrl,
      };
    }
    return map;
  }, [priceData]);

  return (
    <main className="site-shell">
      <ScrollProgress />
      <SiteNav />

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>
            Make your
            <br />
            <em>own</em> market.
          </h1>
          <p className="hero-sub">
            Crate is a simpler way to get exposure to the tokens that belong
            together. One decision. One transaction. No tab hoarding.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#crates">
              Explore crates
            </a>
            <a className="ghost-button" href="#steps">
              How it works
            </a>
          </div>
        </div>
        <HeroArt />
      </section>

      <section className="statement" id="method">
        <h2>
          Not another token.
          <br />
          <span>A better way to see them.</span>
        </h2>
        <p className="statement-copy">
          Markets are made of stories, sectors, and strange little
          constellations. Crates package those relationships into a single,
          transparent onchain buy.
        </p>
      </section>

      <section className="steps" id="steps">
        <div className="steps-grid">
          <div>
            <span>01</span>
            <h3>Pick a point of view.</h3>
            <p>
              Choose a crate built around a sector, a thesis, or just a feeling.
            </p>
          </div>
          <div>
            <span>02</span>
            <h3>Set your amount.</h3>
            <p>
              Tell us how much you want to put in. We handle the proportions.
            </p>
          </div>
          <div>
            <span>03</span>
            <h3>Sign once.</h3>
            <p>
              Your wallet receives every token in a single, transparent
              transaction.
            </p>
          </div>
        </div>
      </section>

      <section className="crates-section" id="crates">
        <div className="section-header">
          <div>
            <h2>Browse the crates.</h2>
          </div>
          <Link className="ghost-button" href="/crates">
            View all crates
          </Link>
        </div>
        <div className="crate-grid">
          {crates.map((crate) => (
            <CrateCard
              crate={crate}
              key={crate.id}
              onSelect={setSelected}
              priceMap={priceMap}
            />
          ))}
        </div>
      </section>

      <section className="closing" id="faq">
        <h2>
          Find your
          <br />
          <em>crate.</em>
        </h2>
        <a className="primary-button" href="#crates">
          Explore the collection
        </a>
      </section>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand-col">
            <Link className="brand" href="/">
              <Mark />
              <span>crate</span>
            </Link>
            <p className="footer-tagline">
              Curated token indexes for Robinhood Chain.
            </p>
            <p className="footer-ca">
              CA:{" "}
              <span className="footer-ca-address">*********************</span>
            </p>
          </div>
          <div className="footer-links-col">
            <p className="footer-col-heading">Product</p>
            <a href="#crates">Crates</a>
            <a href="#steps">How it works</a>
            <Link href="/crates">Browse all</Link>
          </div>
          <div className="footer-links-col">
            <p className="footer-col-heading">Resources</p>
            <Link href="/docs">Documentation</Link>
            <a
              href="https://x.com/tryCrate"
              rel="noopener noreferrer"
              target="_blank"
            >
              X (Twitter)
            </a>
            <a
              href="https://robinhoodchain.blockscout.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              Explorer
            </a>
          </div>
          <div className="footer-cta-col">
            <p className="footer-cta-heading">Find your crate.</p>
            <a className="ghost-button" href="#crates">
              Explore Crates
            </a>
          </div>
        </div>
      </footer>

      {selected !== null && (
        <BuyModal
          crate={selected}
          ethPriceUsd={ethPriceUsd}
          isConnected={isConnected}
          onClose={() => setSelected(null)}
          priceMap={priceMap}
        />
      )}
    </main>
  );
}
