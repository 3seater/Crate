/**
 * Test fixtures: factories, IDs, and domain shapes.
 *
 * Usage:
 *   import { createFixture, createAuthUser, createTokenId } from "../fixtures";
 *   import { createId } from "../helpers";
 */

export { createId } from "../helpers";
export {
  type AuthSessionFixture,
  type AuthUserFixture,
  createAuthSession,
  createAuthUser,
} from "./auth";
export { createFixture, createFixtureList } from "./factory";
export {
  createAddress,
  createConditionId,
  createMarketSlug,
  createOrderId,
  createTokenId,
} from "./ids";
