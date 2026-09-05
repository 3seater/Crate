import type { Metadata } from "next";
import { BASKETS } from "@/config/baskets";

export const metadata: Metadata = { robots: { index: false } };

const ORB_COLOURS = ["#a5e200", "#c8f050", "#8bc400"];
const TOKEN_COLOURS = ["#a5e200", "#d4b2ff", "#f0c56a", "#7ecfff"];

export default function SocialPage() {
  const crates = BASKETS.map((basket, bi) => ({
    ...basket,
    color: ORB_COLOURS[bi % ORB_COLOURS.length],
    tokens: basket.constituents.map((c, ci) => ({
      symbol: c.symbol,
      weight: Math.round(c.weight * 100),
      color: TOKEN_COLOURS[ci % TOKEN_COLOURS.length],
    })),
  }));

  return (
    <div
      style={{
        width: "1000px",
        height: "400px",
        background: "#0b0d09",
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(165,226,0,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Top-right glow */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -80,
          width: 500,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(165,226,0,0.10) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />

      {/* Bottom-left glow */}
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: -60,
          width: 360,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(165,226,0,0.06) 0%, transparent 65%)",
          filter: "blur(60px)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "32px 40px",
          gap: 24,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg
              fill="none"
              height="26"
              viewBox="0 0 368 434"
              width="22"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M338.25,116.95c5.59,6.99,9.91,14.73,10.83,23.83-3.15,49.09,4.26,103.5.07,151.95-1.12,12.93-6.99,22.29-17.28,29.92-41.82,21.67-82.41,50.95-124.33,71.82-17.46,8.69-27.33,9.77-45.26.96-44.42-21.83-89.35-53.83-132.54-78.36-6.93-8.17-10.22-18.12-11.06-28.76-3.62-45.96,2.79-96.62.08-143.09,1.45-16.96,7.78-26.65,21.65-35.87,39.46-26.22,86.34-46.69,126.28-72.83,16.01-6.85,25.49-4.43,40.34,2.97,44.12,21.99,88.43,52.84,131.23,77.47ZM322.55,296.36v-154.12c0-.67-3.89-7.1-5.37-7.9L189.14,60.31l-5.23-1.4v53.83l72.17,42.87c9.29,7.55,16.46,17.02,17.81,29.39,2.88,26.47-2.36,57.61.23,84.58l48.43,26.78ZM108.69,101.68v57.52c2.14.19,4.11,1.07,5.94,2.14,19.4,11.37,42.68,22.66,60.88,35.02,10.7,7.27,20.13,16.32,21.68,29.94,3.01,26.58-2.85,57.76.72,84.82l44.92,27.35,4.49.65c-1.78-46.39,2.35-94.65.04-140.92-1.17-23.53-10.01-22.22-28.55-33.35-36.25-21.76-73.76-41.62-110.13-63.17ZM170.64,368.63v-139.38c0-1.7-6.24-8.19-8.38-9.32l-116.99-66.63v136.43c0,1.51,3.89,9.05,5.96,10.26l119.4,68.64Z"
                fill="none"
                stroke="#a5e200"
                strokeWidth="6"
              />
            </svg>
            <span
              style={{
                color: "#f0f5e8",
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              crate
            </span>
          </div>

          {/* Tag */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(165,226,0,0.08)",
              border: "1px solid rgba(165,226,0,0.2)",
              borderRadius: 999,
              padding: "5px 14px",
              color: "#a5e200",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#a5e200",
                boxShadow: "0 0 6px #a5e200",
                display: "inline-block",
              }}
            />
            {BASKETS.length} Crates Live on Robinhood Chain
          </div>
        </div>

        {/* Crate cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${crates.length}, 1fr)`,
            gap: 10,
            flex: 1,
          }}
        >
          {crates.map((crate) => (
            <div
              key={crate.id}
              style={{
                background: "rgba(15,18,13,0.85)",
                border: "1px solid rgba(165,226,0,0.12)",
                borderRadius: 10,
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: `0 0 20px rgba(165,226,0,0.04), inset 0 1px 0 rgba(165,226,0,0.07)`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Card glow */}
              <div
                style={{
                  position: "absolute",
                  top: -30,
                  right: -30,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: `radial-gradient(ellipse, ${crate.color}22 0%, transparent 70%)`,
                  filter: "blur(16px)",
                }}
              />

              {/* Name */}
              <div
                style={{
                  color: "#f0f5e8",
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.3,
                  position: "relative",
                }}
              >
                {crate.name}
              </div>

              {/* Tokens */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  position: "relative",
                }}
              >
                {crate.tokens.map((t) => (
                  <div
                    key={t.symbol}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: t.color,
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {t.symbol}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "rgba(165,226,0,0.4)",
                      }}
                    >
                      {t.weight}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "rgba(240,245,232,0.25)", fontSize: 11 }}>
            One decision. One transaction. No tab hoarding.
          </span>
          <span
            style={{
              color: "rgba(165,226,0,0.45)",
              fontSize: 11,
              letterSpacing: "0.04em",
            }}
          >
            @tryCrate
          </span>
        </div>
      </div>
    </div>
  );
}
