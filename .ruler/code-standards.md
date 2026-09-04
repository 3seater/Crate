# Code Standards

This project uses **Ultracite** (Biome) for automated formatting and linting. Most issues are auto-fixable with `pnpm fix`. These rules cover what Biome can't enforce automatically.

## Type Safety

- Prefer `unknown` over `any`
- Use const assertions (`as const`) for immutable values and literal types
- Leverage type narrowing instead of type assertions
- Extract magic numbers into named constants

## Modern TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Use template literals over string concatenation
- Use destructuring for object and array assignments

## Async & Promises

- Always `await` promises — don't forget to use the return value
- Use `async/await` over promise chains
- Handle errors with try-catch blocks
- Don't use async functions as Promise executors

## React & JSX

- Function components only
- Hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays
- Use unique IDs for `key` props (not array indices)
- Don't define components inside other components
- Use ref as a prop (React 19+), not `React.forwardRef`
- Use Server Components for async data fetching, not async Client Components
- **Web (`apps/web`):** Do not use the HTML `title` attribute for hover tooltips unless the task explicitly asks for tooltips. Prefer `aria-label` for accessible names; use `@/ui/tooltip` when styled tooltips are requested. Keep `<iframe title>` and SVG `<title>` for a11y.

## Accessibility

- Meaningful alt text for images
- Proper heading hierarchy
- Labels for form inputs
- Keyboard event handlers alongside mouse events
- Semantic elements (`<button>`, `<nav>`) instead of divs with roles

## Error Handling

- No `console.log`, `debugger`, or `alert` in production code
- Throw `Error` objects with descriptive messages, not strings
- Prefer early returns over nested conditionals
- **tRPC procedures** must throw `TRPCError` or `AppError` (not raw `Error` or `ApiError`)
- Use `AppError` when why/fix/link improve UX (auth, trading); use `TRPCError` for simple cases
- Polymarket client errors must be caught at the router boundary and converted via `mapApiErrorToTRPC` so the client never receives internal ApiError messages
- **Next.js server actions**: Do not wrap `redirect()`, `notFound()`, `forbidden()`, or `unauthorized()` in try-catch; they throw internally. If you must catch in the same block, use `unstable_rethrow(error)` to re-throw Next.js navigation errors

## Security

- `rel="noopener"` on `target="_blank"` links
- No `dangerouslySetInnerHTML` unless absolutely necessary
- No `eval()` or direct `document.cookie` assignment
- Validate and sanitize user input

## Performance

- No spread syntax in accumulators within loops
- Top-level regex literals, not created in loops
- Specific imports over namespace imports
- No barrel files in app code — prefer direct imports. Packages may use `index.ts` for public API.
- Use Next.js `<Image>` component, not `<img>` tags

## Testing

- Assertions inside `it()` or `test()` blocks only
- Use async/await, not done callbacks
- No `.only` or `.skip` in committed code
- Keep test suites flat — avoid excessive `describe` nesting

## What Biome Won't Catch

Focus manual review on: business logic correctness, meaningful naming, architecture decisions, edge cases, UX, and documentation for complex logic.
