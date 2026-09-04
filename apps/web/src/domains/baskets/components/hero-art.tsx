"use client";

import { useEffect, useRef } from "react";

export function HeroArt() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // normalise to -1 → 1
      targetRef.current = {
        x: (e.clientX - cx) / (rect.width / 2),
        y: (e.clientY - cy) / (rect.height / 2),
      };
    };

    const onMouseLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    const tick = () => {
      // lerp toward target — lazy trailing feel
      const lerp = 0.06;
      currentRef.current.x +=
        (targetRef.current.x - currentRef.current.x) * lerp;
      currentRef.current.y +=
        (targetRef.current.y - currentRef.current.y) * lerp;

      const rx = currentRef.current.y * -12; // tilt up/down
      const ry = currentRef.current.x * 14; // tilt left/right

      el.style.setProperty("--rx", `${rx}deg`);
      el.style.setProperty("--ry", `${ry}deg`);

      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div aria-hidden="true" className="hero-art" ref={containerRef}>
      {/* perspective stage */}
      <div className="hero-art-stage">
        {/* orbital rings */}
        <div className="hero-ring hero-ring-outer" />
        <div className="hero-ring hero-ring-mid" />
        <div className="hero-ring hero-ring-inner" />

        {/* logo centrepiece */}
        <div className="hero-logo-wrap">
          {/* glow layer behind svg */}
          <div className="hero-logo-glow" />
          <svg
            className="hero-logo-svg"
            fill="none"
            viewBox="0 0 368 434"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M338.25,116.95c5.59,6.99,9.91,14.73,10.83,23.83-3.15,49.09,4.26,103.5.07,151.95-1.12,12.93-6.99,22.29-17.28,29.92-41.82,21.67-82.41,50.95-124.33,71.82-17.46,8.69-27.33,9.77-45.26.96-44.42-21.83-89.35-53.83-132.54-78.36-6.93-8.17-10.22-18.12-11.06-28.76-3.62-45.96,2.79-96.62.08-143.09,1.45-16.96,7.78-26.65,21.65-35.87,39.46-26.22,86.34-46.69,126.28-72.83,16.01-6.85,25.49-4.43,40.34,2.97,44.12,21.99,88.43,52.84,131.23,77.47ZM322.55,296.36v-154.12c0-.67-3.89-7.1-5.37-7.9L189.14,60.31l-5.23-1.4v53.83l72.17,42.87c9.29,7.55,16.46,17.02,17.81,29.39,2.88,26.47-2.36,57.61.23,84.58l48.43,26.78ZM108.69,101.68v57.52c2.14.19,4.11,1.07,5.94,2.14,19.4,11.37,42.68,22.66,60.88,35.02,10.7,7.27,20.13,16.32,21.68,29.94,3.01,26.58-2.85,57.76.72,84.82l44.92,27.35,4.49.65c-1.78-46.39,2.35-94.65.04-140.92-1.17-23.53-10.01-22.22-28.55-33.35-36.25-21.76-73.76-41.62-110.13-63.17ZM170.64,368.63v-139.38c0-1.7-6.24-8.19-8.38-9.32l-116.99-66.63v136.43c0,1.51,3.89,9.05,5.96,10.26l119.4,68.64Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* floating particles */}
        <div className="hero-particle hero-particle-1" />
        <div className="hero-particle hero-particle-2" />
        <div className="hero-particle hero-particle-3" />
        <div className="hero-particle hero-particle-4" />
      </div>
    </div>
  );
}
