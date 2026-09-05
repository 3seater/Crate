import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

const CRATES = [
  {
    name: "Blue Chips",
    tokens: ["PONS", "CASHCAT", "AI"],
    color: "#a5e200",
  },
  {
    name: "Feline Index",
    tokens: ["CASHCAT", "HMM", "ROBINCAT"],
    color: "#a5e200",
  },
  {
    name: "DeFi Core",
    tokens: ["DELTA", "UP", "ARROW"],
    color: "#a5e200",
  },
  {
    name: "Launchpad Pack",
    tokens: ["PONS", "STONKBROKER"],
    color: "#a5e200",
  },
  {
    name: "AI & Infra",
    tokens: ["AI", "QGRID", "MICRON"],
    color: "#a5e200",
  },
  {
    name: "Mag 4",
    tokens: ["NVDA", "AAPL", "TSLA", "SPY"],
    color: "#a5e200",
  },
];

export default function SocialPage() {
  return (
    <div
      style={{
        width: "1000px",
        height: "400px",
        background: "#0b0d09",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "40px 48px",
      }}
    >
      {/* Dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(165,226,0,0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          zIndex: 0,
        }}
      />

      {/* Green glow top-right */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -60,
          width: 400,
          height: 340,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(165,226,0,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
          zIndex: 0,
        }}
      />

      {/* Green glow bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: -40,
          width: 300,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(165,226,0,0.07) 0%, transparent 70%)",
          filter: "blur(50px)",
          zIndex: 0,
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Logo mark */}
          <svg
            fill="none"
            height="28"
            viewBox="0 0 368 434"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M338.25,116.95c5.59,6.99,9.91,14.73,10.83,23.83-3.15,49.09,4.26,103.5.07,151.95-1.12,12.93-6.99,22.29-17.28,29.92-41.82,21.67-82.41,50.95-124.33,71.82-17.46,8.69-27.33,9.77-45.26.96-44.42-21.83-89.35-53.83-132.54-78.36-6.93-8.17-10.22-18.12-11.06-28.76-3.62-45.96,2.79-96.62.08-143.09,1.45-16.96,7.78-26.65,21.65-35.87,39.46-26.22,86.34-46.69,126.28-72.83,16.01-6.85,25.49-4.43,40.34,2.97,44.12,21.99,88.43,52.84,131.23,77.47ZM322.55,296.36v-154.12c0-.67-3.89-7.1-5.37-7.9L189.14,60.31l-5.23-1.4v53.83l72.17,42.87c9.29,7.55,16.46,17.02,17.81,29.39,2.88,26.47-2.36,57.61.23,84.58l48.43,26.78ZM108.69,101.68v57.52c2.14.19,4.11,1.07,5.94,2.14,19.4,11.37,42.68,22.66,60.88,35.02,10.7,7.27,20.13,16.32,21.68,29.94,3.01,26.58-2.85,57.76.72,84.82l44.92,27.35,4.49.65c-1.78-46.39,2.35-94.65.04-140.92-1.17-23.53-10.01-22.22-28.55-33.35-36.25-21.76-73.76-41.62-110.13-63.17ZM170.64,368.63v-139.38c0-1.7-6.24-8.19-8.38-9.32l-116.99-66.63v136.43c0,1.51,3.89,9.05,5.96,10.26l119.4,68.64Z"
              fill="none"
              stroke="#a5e200"
              strokeWidth="8"
            />
          </svg>
          <span
            style={{
              color: "#f0f5e8",
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            crate
          </span>
        </div>
        <div
          style={{
            color: "rgba(165,226,0,0.7)",
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Robinhood Chain · 6 Crates Live
        </div>
      </div>

      {/* Crate cards */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
          marginTop: 24,
        }}
      >
        {CRATES.map((crate) => (
          <div
            key={crate.name}
            style={{
              background: "rgba(15,18,13,0.8)",
              border: "1px solid rgba(165,226,0,0.15)",
              borderRadius: 10,
              padding: "14px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow:
                "0 0 24px rgba(165,226,0,0.06), inset 0 1px 0 rgba(165,226,0,0.08)",
            }}
          >
            <div
              style={{
                color: "#f0f5e8",
                fontSize: 12,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              {crate.name}
            </div>
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
              }}
            >
              {crate.tokens.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    color: "rgba(165,226,0,0.8)",
                    background: "rgba(165,226,0,0.08)",
                    borderRadius: 4,
                    padding: "2px 5px",
                    letterSpacing: "0.03em",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 20,
        }}
      >
        <div style={{ color: "rgba(240,245,232,0.3)", fontSize: 11 }}>
          One decision. One transaction.
        </div>
        <div
          style={{
            color: "rgba(165,226,0,0.5)",
            fontSize: 11,
            letterSpacing: "0.04em",
          }}
        >
          @tryCrate
        </div>
      </div>
    </div>
  );
}
