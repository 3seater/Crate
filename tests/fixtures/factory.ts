/**
 * Generic fixture factory: merge defaults with partial overrides.
 * Use for building test objects without repeating boilerplate.
 *
 * @example
 * const user = createFixture(defaultUser, { email: "custom@test.com" });
 */
export function createFixture<T extends object>(
  defaults: T,
  overrides?: Partial<T>
): T {
  if (overrides == null) {
    return { ...defaults };
  }
  return { ...defaults, ...overrides } as T;
}

/**
 * Create an array of fixtures with optional per-item overrides.
 *
 * @example
 * const users = createFixtureList(3, defaultUser, (i) => ({ email: `u${i}@test.com` }));
 */
export function createFixtureList<T extends object>(
  count: number,
  defaults: T,
  overrideFn?: (index: number) => Partial<T>
): T[] {
  return Array.from({ length: count }, (_, i) =>
    createFixture(defaults, overrideFn?.(i))
  );
}
