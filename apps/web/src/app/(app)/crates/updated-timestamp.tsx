"use client";

import { useEffect, useState } from "react";

export function UpdatedTimestamp() {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSecondsAgo((s) => s + 60), 60_000);
    return () => clearInterval(id);
  }, []);

  let display: string;
  if (secondsAgo < 60) {
    display = "just now";
  } else if (secondsAgo < 3600) {
    const minutes = Math.floor(secondsAgo / 60);
    display = `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  } else {
    const hours = Math.floor(secondsAgo / 3600);
    display = `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  return (
    <span className="text-[color:var(--text-tertiary)] text-xs">
      Updated {display}
    </span>
  );
}
