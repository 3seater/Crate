# Documentation Site

> Scope: `apps/docs` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

Fumadocs-powered documentation for the Doji monorepo.

## Quick Facts

- **Port:** 3002
- **Commands:** `pnpm dev:docs`, `pnpm build`, `pnpm check-types`
- **URLs:** Page paths are root-relative (`/`, `/portfolio`, and so on). Deploy
  this app on its own host (for example, `docs.doji.bet`) so `/` is the docs
  site, not a subpath under the web app.

## Tech Stack

Fumadocs · Next.js 16.2 (canary) · MDX · Tailwind v4

**Theme:** `src/app/global.css` uses Fumadocs’ [shadcn preset](https://www.fumadocs.dev/docs/ui/theme) (`fumadocs-ui/css/shadcn.css` + `preset.css`). Dark mode uses the Doji theme palette from `apps/web/src/index.css` (`.doji`): brand `#bff85a`. `RootProvider` defaults to dark (`defaultTheme: "dark"`, `enableSystem: false`). Fonts: Inter / Inter Mono (same as web).

## Structure

```
src/
├── app/
│   ├── layout.tsx        # Root layout with RootProvider
│   ├── global.css
│   ├── sitemap.ts        # Dynamic sitemap generation
│   ├── robots.ts         # robots.txt generation
│   ├── manifest.ts       # Web app manifest
│   ├── opengraph-image.tsx  # Default OG image
│   ├── twitter-image.tsx    # Default Twitter card image
│   ├── icon.ts           # Favicon
│   ├── apple-icon.ts     # Apple touch icon
│   ├── (docs)/           # Route group: docs layout + pages
│   │   ├── layout.tsx    # DocsLayout + sidebar
│   │   └── [[...slug]]/
│   │       └── page.tsx  # Dynamic docs pages
│   ├── api/search/       # Search API route
│   ├── og/[...slug]/     # OG images for doc pages
│   ├── llms.mdx/         # LLM-oriented docs route
│   ├── llms.txt/         # LLM text route
│   └── llms-full.txt/    # Full LLM text route
├── components/
│   ├── doji-logo.tsx     # Inline SVG logo (same asset as web)
│   ├── ai/
│   │   └── page-actions.tsx  # AI page action buttons (e.g. "Ask AI" prompts)
│   └── docs/
│       ├── callout.tsx   # Custom callout MDX component
│       └── shortcut.tsx  # Keyboard shortcut display component
├── fonts/
│   └── InterVariable.woff2  # Self-hosted Inter variable font
├── mdx-components.tsx    # Global MDX component overrides
└── lib/
    ├── source.ts         # Content loader (getPageImage, getLLMText)
    ├── layout.shared.tsx # Shared layout elements (nav title with Doji logo)
    └── cn.ts             # clsx + tailwind-merge helper

content/docs/              # MDX documentation files
source.config.ts           # Fumadocs MDX config (root)
```

**End-user sections** (sidebar via `content/docs/meta.json`): [Separators](https://fumadocs.dev/docs/page-conventions#pages);
groups follow [`docs/documentation-layout-best-practices.md`](../../docs/documentation-layout-best-practices.md).
**Reference** lists `./reference/glossary`, `./reference/markets`,
`./reference/trading`, and `./reference/wallet`. All paths are explicit in
`meta.json`. Do **not** set **`root: true`** on section folders — in Fumadocs,
[root folders](https://www.fumadocs.dev/docs/page-conventions#root-folder) become
layout tabs and the sidebar scopes to the active root. Use normal folders with an
`index` page titled **Overview** in frontmatter where needed.

`(docs)/layout.tsx` sets **`sidebar: { tabs: false }`** so [layout
tabs](https://www.fumadocs.dev/docs/ui/layouts/docs#layout-tabs) (the root-folder
dropdown) stay off unless you opt in.

## Adding Documentation

Create MDX files in `content/docs/`:

```mdx
---
title: Page Title
description: Page description
---

# Your Content

Write documentation in Markdown/MDX.
```

## Features

- **MDX Support** - Write docs in Markdown with JSX
- **Syntax Highlighting** - Code blocks with themes
- **Search** - Built-in search functionality
- **Navigation** - Auto-generated from file structure
- **Dark Mode** - Theme switching support

## Development

```bash
pnpm dev:docs         # Start dev server (localhost:3002)
pnpm build            # Build for production
pnpm check-types      # TypeScript validation
```

## Configuration

### Source Config

`source.config.ts` - Configure MDX processing:

```typescript
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const { docs, meta } = defineDocs();

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: { light: "github-light", dark: "github-dark" },
    },
  },
});
```

### Content Loader

`src/lib/source.ts` - Load MDX content (Fumadocs headless source API):

```typescript
import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

export const source = loader({
  baseUrl: "",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});
```

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if you changed structure or content workflow.
- [ ] Summarize changes in conventional commit form (e.g. `docs: ...`).

## Related

- [Fumadocs Documentation](https://fumadocs.dev)
- [Web App](../web/AGENTS.md)
- [Server API](../server/AGENTS.md)
