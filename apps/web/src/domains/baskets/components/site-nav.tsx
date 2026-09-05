"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";

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

export function SiteNav() {
  return (
    <nav className="nav">
      <Link className="brand" href="/">
        <Mark />
        <span>crate</span>
      </Link>
      <div className="nav-links">
        <Link href="/">Overview</Link>
        <Link href="/crates">Crates</Link>
        <a href="/#steps">How it works</a>
        <a href="/#faq">FAQ</a>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <ConnectButton
          accountStatus="address"
          chainStatus="none"
          showBalance={false}
        />
      </div>
    </nav>
  );
}
