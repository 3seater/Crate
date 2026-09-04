import Image from "next/image";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";
import { ScrollProgress } from "@/domains/baskets/components/scroll-progress";

export const metadata = createPageMetadata({
  title: { absolute: "Docs — Crate" },
  description:
    "Learn how Crate works — curated token indexes for Robinhood Chain.",
});

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

const SECTIONS = [
  {
    id: "what-is-crate",
    heading: "What is Crate?",
    body: `Crate is a basket terminal built on Robinhood Chain. Instead of buying tokens one by one, you pick a crate — a curated index built around a sector, thesis, or conviction — set an amount, and sign once. Your wallet receives every token in the basket in a single, transparent onchain transaction.`,
  },
  {
    id: "how-it-works",
    heading: "How it works",
    body: `When you buy a crate, the contract splits your input into the constituent tokens according to their preset weights. No routing through a DEX aggregator, no slippage compounding across multiple swaps — just one call. When you exit, the reverse happens: your tokens are returned to a single asset.`,
  },
  {
    id: "crates",
    heading: "The crates",
    body: `Each crate has a fixed set of constituents and weights. Weights are rebalanced periodically by the Crate team. Current crates: Blue Chips (blue-chip exposure), Feline Index (cat coin sector), and RHC Ecosystem (Robinhood Chain native protocols). More crates will be added as the ecosystem grows.`,
  },
  {
    id: "robinhood-chain",
    heading: "Robinhood Chain",
    body: `Crate is deployed on Robinhood Chain (chain ID 4663). You'll need a wallet connected to this network and a small amount of native gas to sign transactions. You can verify any transaction on the Robinhood Chain block explorer.`,
  },
  {
    id: "fees",
    heading: "Fees",
    body: `Crate charges a small protocol fee on each buy and exit. This fee is taken from the input amount before the basket split. The exact fee is displayed in the order panel before you confirm. There are no hidden fees.`,
  },
  {
    id: "security",
    heading: "Security",
    body: `Crate contracts are non-custodial — your funds move directly from your wallet to the constituent tokens. The contracts are not upgradeable. A full audit will be published here before the public launch. In the meantime, use the testnet or keep amounts small.`,
  },
  {
    id: "faq",
    heading: "FAQ",
    body: null,
    faq: [
      {
        q: "Do I need to approve each token separately?",
        a: "No. One approval and one transaction covers the full basket buy.",
      },
      {
        q: "Can I sell part of a crate?",
        a: "Currently the exit panel exits the full position. Partial exits are on the roadmap.",
      },
      {
        q: "What happens if a token in a crate gets delisted?",
        a: "The Crate team will update the constituent list and communicate via X (@tryCrate) before any change takes effect.",
      },
      {
        q: "Is there a token?",
        a: "Not yet. Follow @tryCrate for updates.",
      },
    ],
  },
];

export default function DocsPage() {
  return (
    <main className="docs-shell">
      <ScrollProgress />
      {/* Nav */}
      <nav className="nav">
        <Link className="brand" href="/">
          <Mark />
          <span>crate</span>
        </Link>
        <div className="nav-links">
          <Link href="/">Overview</Link>
          <Link href="/crates">Crates</Link>
          <Link href="/docs">Docs</Link>
        </div>
        <Link className="ghost-button" href="/">
          ← Back
        </Link>
      </nav>

      <div className="docs-layout">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <p className="docs-sidebar-heading">On this page</p>
          <nav aria-label="Docs sections">
            {SECTIONS.map((s) => (
              <a className="docs-sidebar-link" href={`#${s.id}`} key={s.id}>
                {s.heading}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="docs-content">
          <header className="docs-hero">
            <p className="eyebrow">Documentation</p>
            <h1>
              How <em>Crate</em> works.
            </h1>
            <p className="docs-hero-sub">
              Everything you need to know before your first basket buy.
            </p>
          </header>

          {SECTIONS.map((s) => (
            <section className="docs-section" id={s.id} key={s.id}>
              <h2>{s.heading}</h2>
              {s.body && <p>{s.body}</p>}
              {s.faq && (
                <dl className="docs-faq">
                  {s.faq.map((item) => (
                    <div className="docs-faq-item" key={item.q}>
                      <dt>{item.q}</dt>
                      <dd>{item.a}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}

          <div className="docs-footer-cta">
            <p>Ready to start?</p>
            <Link className="primary-button" href="/#crates">
              Explore crates
            </Link>
          </div>
        </article>
      </div>

      {/* Site footer */}
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
