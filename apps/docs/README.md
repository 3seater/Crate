# Docs

Fumadocs-powered documentation site for the Doji monorepo. Part of the monorepo; use **pnpm** (never npm/yarn).

Run development server:

```bash
pnpm dev:docs
# or from repo root: pnpm dev (starts all apps)
```

Open <http://localhost:3002> with your browser. In production, point a
dedicated subdomain (for example, `docs.doji.bet`) at this app so URLs look
like `https://docs.doji.bet/portfolio`, not `/docs/...` on the main site.

## Explore

In the project, you can see:

- `lib/source.ts`: Code for content source adapter, [`loader()`](https://fumadocs.dev/docs/headless/source-api) provides the interface to access your content.
- `lib/layout.shared.tsx`: Shared options for layouts, optional but preferred to keep.

| Route                      | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `app/(docs)/[[...slug]]`   | Documentation pages at `/…` (root-relative paths).     |
| `app/api/search/route.ts`  | The Route Handler for search.                          |

### Fumadocs MDX

A `source.config.ts` config file has been included, you can customise different options like frontmatter schema.

Read the [Introduction](https://fumadocs.dev/docs/mdx) for further details.

## Learn More

To learn more about Next.js and Fumadocs, take a look at the following
resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js
  features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Fumadocs](https://fumadocs.dev) - learn about Fumadocs
