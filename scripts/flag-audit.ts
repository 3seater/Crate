/**
 * Flag audit — fails if release/experiment flags are past their expectedRemoval date.
 * Run: pnpm flag-audit
 */

import { FLAG_REGISTRY } from "../apps/web/src/lib/flags/definitions";

const now = new Date();
const expired: string[] = [];

for (const meta of FLAG_REGISTRY) {
  if (meta.type === "ops" || meta.type === "permission") {
    continue;
  }
  if (!meta.expectedRemoval) {
    continue;
  }
  if (now > new Date(meta.expectedRemoval)) {
    const days = Math.floor(
      (now.getTime() - new Date(meta.expectedRemoval).getTime()) / 86_400_000
    );
    expired.push(
      `${meta.key} — ${days} days overdue (owner: ${meta.owner ?? "unassigned"})`
    );
  }
}

if (expired.length > 0) {
  console.error("🚨 EXPIRED FLAGS:");
  for (const f of expired) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log("✅ No expired flags.");
}
