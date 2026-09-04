import CrateApp from "@/domains/baskets/components/crate-app";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: { absolute: "Crate — Make your own market" },
  description: "Curated token indexes for Robinhood Chain.",
  openGraph: { siteName: "Crate", title: "Crate — Make your own market" },
});

export default function HomePage() {
  return <CrateApp />;
}
