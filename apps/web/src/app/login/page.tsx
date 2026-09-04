"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = inputRef.current?.value ?? "";
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (res.ok) {
      const next = searchParams.get("next") ?? "/";
      router.push(next);
      router.refresh();
    } else {
      setError(true);
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0b09",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "340px",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Image
            alt="Crate"
            height={28}
            src="/crate-logo.svg"
            unoptimized
            width={28}
          />
          <span
            style={{
              fontSize: "20px",
              fontWeight: 500,
              color: "#f5f5f5",
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-inter, system-ui, sans-serif)",
            }}
          >
            crate
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#a79c92",
              fontFamily: "var(--font-inter, system-ui, sans-serif)",
            }}
          >
            Enter password to continue
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <input
              aria-label="Password"
              autoComplete="current-password"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              placeholder="••••••"
              ref={inputRef}
              required
              type="password"
              style={{
                width: "100%",
                height: "44px",
                padding: "0 14px",
                background: "transparent",
                border: `1px solid ${error ? "rgba(240,80,80,0.6)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "6px",
                color: "#f5f5f5",
                fontSize: "20px",
                letterSpacing: "0.25em",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "var(--font-inter, system-ui, sans-serif)",
                transition: "border-color 0.15s ease",
              }}
            />
            {error && (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "rgba(240,100,100,0.9)",
                  fontFamily: "var(--font-inter, system-ui, sans-serif)",
                }}
              >
                Incorrect password
              </p>
            )}
            <button
              disabled={loading}
              type="submit"
              style={{
                height: "44px",
                background: "#f5f5f5",
                color: "#0d0b09",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                fontFamily: "var(--font-inter, system-ui, sans-serif)",
                transition: "opacity 0.15s ease",
              }}
            >
              {loading ? "…" : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
