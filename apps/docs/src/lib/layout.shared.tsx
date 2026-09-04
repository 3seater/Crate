import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { DojiLogo } from "@/components/doji-logo";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <DojiLogo className="h-7 w-auto shrink-0 md:h-8" />,
    },
    links: [
      {
        text: "App",
        url: "https://doji.bet",
        active: "nested-url",
      },
      {
        text: "Discord",
        url: "https://discord.gg/doji",
        active: "none",
      },
    ],
  };
}
