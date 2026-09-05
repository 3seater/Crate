import Image from "next/image";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";
import { ScrollProgress } from "@/domains/baskets/components/scroll-progress";
import { CrateGrid } from "@/domains/baskets/components/crate-grid";
import { SiteNav } from "@/domains/baskets/components/site-nav";

export const metadata = createPageMetadata({
  title: { absolute: "All Crates — Crate" },
  description: "Curated token indexes for Robinhood Chain.",
});

export default function CratesPage() {
  return (
    <main className="site-shell">
      <ScrollProgress />
      <SiteNav />

      <section className="catalog-hero">
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
        <CrateGrid />
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
            <Link className="ghost-button" href="/crates">
              Explore Crates
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
