import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <DocsLayout
      sidebar={{
        defaultOpenLevel: 1,
        // Disable layout tabs (root-folder dropdown); see
        // https://www.fumadocs.dev/docs/ui/layouts/docs#layout-tabs
        tabs: false,
      }}
      tree={source.getPageTree()}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}
