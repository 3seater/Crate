import Link from "next/link";

/**
 * Hero section for the home page.
 * Server Component — no "use client" needed.
 *
 * Requirements: 3.1–3.6, 7.4, 9.5
 */
export function HomeHero() {
  return (
    <section className="relative px-8 pt-20 pb-12 md:px-16">
      <div className="relative">
        {/* Display heading — left-aligned, ultra-bold */}
        <h1
          className="font-sans text-[color:var(--text-primary)]"
          style={{
            fontSize: "clamp(72px,10vw,160px)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Trade in Crates.
        </h1>
        {/* Subheadline — right-positioned on desktop */}
        <p className="absolute top-1/2 right-0 hidden max-w-[300px] -translate-y-1/2 text-[color:var(--text-secondary)] text-sm md:block">
          Buy curated on-chain token crates with a single transaction on
          Robinhood Chain.
        </p>
      </div>
      {/* Subheadline — below heading on mobile */}
      <p className="mt-4 max-w-sm text-[color:var(--text-secondary)] text-sm md:hidden">
        Buy curated on-chain token crates with a single transaction on Robinhood
        Chain.
      </p>
      {/* CTA */}
      <Link
        className="mt-8 inline-flex h-9 items-center border border-[color:var(--border-strong)] px-5 text-[color:var(--text-primary)] text-sm transition-colors duration-200 hover:border-[color:var(--crate-orange)] hover:text-[color:var(--crate-orange)]"
        href="/crates"
      >
        Enter app →
      </Link>
    </section>
  );
}
