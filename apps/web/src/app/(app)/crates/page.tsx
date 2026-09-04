import Image from "next/image";
import Link from "next/link";
import { BASKETS } from "@/config/baskets";
import { createPageMetadata } from "@/lib/seo";
import { ScrollProgress } from "@/domains/baskets/components/scroll-progress";

export const metadata = createPageMetadata({
  title: { absolute: "All Crates — Crate" },
  description: "Curated token indexes for Robinhood Chain.",
});

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
const CATEGORY = ["Core", "Mid Cap", "Degen"];
const CHANGE = ["+18.42%", "+24.06%", "+9.81%"];

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

export default function CratesPage() {
  return (
    <main className="site-shell">
      <ScrollProgress />
      <nav className="nav">
        <Link className="brand" href="/">
          <Mark />
          <span>crate</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Overview</Link>
          <Link href="/crates">Crates</Link>
          <a href="/#steps">How it works</a>
        </div>
        <Link className="ghost-button" href="/">
          ← Back
        </Link>
      </nav>

      <section className="catalog-hero">
        <p className="eyebrow">All crates</p>
        <h1>
          All <em>crates.</em>
        </h1>
        <p>
          Curated token indexes for different convictions, sectors, and seasons.
          Choose a point of view, then choose your size.
        </p>
      </section>

      <section className="crates-section catalog-section">
        <div className="section-header">
          <div>
            <h2>Find your mix.</h2>
          </div>
          <Link className="ghost-button" href="/">
            Back to overview
          </Link>
        </div>
        <div className="crate-grid">
          {BASKETS.map((basket, bi) => {
            const ticker = basket.id
              .replace(/-/g, "")
              .toUpperCase()
              .slice(0, 8);
            const tokens = basket.constituents.map((c, ci) => ({
              symbol: c.symbol,
              weight: Math.round(c.weight * 100),
              color: TOKEN_COLOURS[ci % TOKEN_COLOURS.length],
            }));
            return (
              <article className="crate-card" key={basket.id}>
                <div className="crate-topline">
                  <span className="eyebrow">{CATEGORY[bi]}</span>
                  <span className="live-dot">Live</span>
                </div>
                <div className="crate-card-heading">
                  <div>
                    <h3>{basket.name}</h3>
                    <p className="ticker">${ticker}</p>
                  </div>
                  <div
                    className="crate-orb"
                    style={
                      {
                        "--orb": ORB_COLOURS[bi % ORB_COLOURS.length],
                      } as React.CSSProperties
                    }
                  >
                    <span>{tokens[0]?.symbol.slice(0, 2)}</span>
                  </div>
                </div>
                <p className="crate-desc">{basket.description}</p>
                <div className="allocation-row">
                  {tokens.map((token) => (
                    <div
                      key={token.symbol}
                      style={{
                        width: `${token.weight}%`,
                        background: token.color,
                      }}
                    />
                  ))}
                </div>
                <div className="token-list">
                  {tokens.map((token) => (
                    <span key={token.symbol}>
                      {token.symbol} <b>{token.weight}%</b>
                    </span>
                  ))}
                </div>
                <div className="crate-footer">
                  <span className="change">
                    {CHANGE[bi]} <small>30d</small>
                  </span>
                  <Link className="text-button" href={`/crates/${basket.id}`}>
                    Open crate
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
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
            <Link href="/#crates">Crates</Link>
            <Link href="/#steps">How it works</Link>
            <Link href="/crates">Browse all</Link>
          </div>
          <div className="footer-links-col">
            <p className="footer-col-heading">Resources</p>
            <Link href="/docs">Documentation</Link>
            <a
              href="https://x.com/useCrate"
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
            <Link className="ghost-button" href="/crates">
              Explore Crates
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
