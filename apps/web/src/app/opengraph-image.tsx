import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Crate — Curated token indexes for Robinhood Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        background: "#0b0d09",
        padding: "72px 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle dot grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(165,226,0,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Warm glow top-right */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 700,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(165,226,0,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Logo mark — simplified crate shape */}
      <div
        style={{
          position: "absolute",
          right: 80,
          top: "50%",
          transform: "translateY(-50%)",
          width: 280,
          height: 280,
          opacity: 0.15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          fill="none"
          height="280"
          viewBox="0 0 368 434"
          width="280"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M338.25,116.95c5.59,6.99,9.91,14.73,10.83,23.83-3.15,49.09,4.26,103.5.07,151.95-1.12,12.93-6.99,22.29-17.28,29.92-41.82,21.67-82.41,50.95-124.33,71.82-17.46,8.69-27.33,9.77-45.26.96-44.42-21.83-89.35-53.83-132.54-78.36-6.93-8.17-10.22-18.12-11.06-28.76-3.62-45.96,2.79-96.62.08-143.09,1.45-16.96,7.78-26.65,21.65-35.87,39.46-26.22,86.34-46.69,126.28-72.83,16.01-6.85,25.49-4.43,40.34,2.97,44.12,21.99,88.43,52.84,131.23,77.47ZM322.55,296.36v-154.12c0-.67-3.89-7.1-5.37-7.9L189.14,60.31l-5.23-1.4v53.83l72.17,42.87c9.29,7.55,16.46,17.02,17.81,29.39,2.88,26.47-2.36,57.61.23,84.58l48.43,26.78ZM108.69,101.68v57.52c2.14.19,4.11,1.07,5.94,2.14,19.4,11.37,42.68,22.66,60.88,35.02,10.7,7.27,20.13,16.32,21.68,29.94,3.01,26.58-2.85,57.76.72,84.82l44.92,27.35,4.49.65c-1.78-46.39,2.35-94.65.04-140.92-1.17-23.53-10.01-22.22-28.55-33.35-36.25-21.76-73.76-41.62-110.13-63.17ZM170.64,368.63v-139.38c0-1.7-6.24-8.19-8.38-9.32l-116.99-66.63v136.43c0,1.51,3.89,9.05,5.96,10.26l119.4,68.64Z"
            fill="#a5e200"
          />
        </svg>
      </div>

      {/* Bottom divider line */}
      <div
        style={{
          position: "absolute",
          bottom: 130,
          left: 80,
          right: 80,
          height: 1,
          background: "rgba(255,255,255,0.08)",
        }}
      />

      {/* Content */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 16, zIndex: 1 }}
      >
        {/* Eyebrow */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#a5e200",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          ROBINHOOD CHAIN
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 400,
            color: "#f5f5f5",
            letterSpacing: "-0.05em",
            lineHeight: 0.9,
          }}
        >
          crate
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 22,
            color: "#a79c92",
            fontWeight: 400,
            marginTop: 8,
            maxWidth: 520,
            lineHeight: 1.4,
          }}
        >
          Curated token indexes. One decision. One transaction.
        </div>
      </div>

      {/* Bottom tag */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 80,
          fontSize: 14,
          color: "#5a5046",
          letterSpacing: "0.04em",
        }}
      >
        trycrate.xyz
      </div>
    </div>,
    { ...size }
  );
}
