import "../index.css";

import Link from "next/link";
import { Button } from "@/ui/button";

export default function GlobalNotFound() {
  return (
    <html className="doji" lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-background font-sans text-text-primary">
        <div className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="font-medium text-[120px] text-text-tertiary leading-none tracking-tight">
              404
            </span>
            <h1 className="font-medium text-lg text-text-primary">
              Page Not Found
            </h1>
            <p className="max-w-sm text-sm text-text-secondary">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved.
            </p>
          </div>
          <Link href="/">
            <Button variant="default">Go Home</Button>
          </Link>
        </div>
      </body>
    </html>
  );
}
