import type { Metadata } from "next";
import localFont from "next/font/local";

import "../index.css";

import { AnalyticsScripts } from "@/lib/analytics/scripts";
import { SentryContext } from "@/lib/sentry/context";
import { defaultMetadata } from "@/lib/seo/metadata";
import Providers from "@/shell/providers";

const inter = localFont({
  src: "../fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
        <SentryContext />
        {process.env.NODE_ENV === "production" && <AnalyticsScripts />}
      </body>
    </html>
  );
}
