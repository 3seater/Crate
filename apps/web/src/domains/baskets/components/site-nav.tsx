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

function WalletIcon() {
  return (
    <svg
      fill="none"
      height="15"
      viewBox="0 0 16 15"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
        width="13"
        x="1.5"
        y="3.5"
      />
      <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="11.5" cy="9.5" fill="currentColor" r="1" />
      <path
        d="M4 2.5h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.25"
      />
    </svg>
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
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openConnectModal,
            mounted,
          }) => {
            const connected = mounted && account && chain;
            return (
              <button
                className="nav-connect-btn"
                onClick={connected ? openAccountModal : openConnectModal}
                type="button"
              >
                <WalletIcon />
                <span>{connected ? account.displayName : "Connect"}</span>
              </button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </nav>
  );
}
