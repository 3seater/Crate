/**
 * Auth-shaped fixtures for tests (session, user).
 * Shapes match @doji/types AuthUser / AuthSession; no package dependency.
 */

import { createId } from "../helpers";
import { createFixture } from "./factory";
import { createAddress } from "./ids";

export interface AuthUserFixture {
  email: string;
  hasCredentials: boolean;
  id: string;
  safeAddress: string | null;
  walletAddress: string;
}

const defaultAuthUser: AuthUserFixture = {
  id: "",
  email: "test@example.com",
  walletAddress: createAddress(1),
  safeAddress: createAddress(2),
  hasCredentials: false,
};

export function createAuthUser(
  overrides?: Partial<AuthUserFixture>
): AuthUserFixture {
  return createFixture(
    {
      ...defaultAuthUser,
      id: createId("user", 1),
    },
    overrides
  );
}

export interface AuthSessionFixture {
  issuer: string;
  userId: string;
}

const defaultAuthSession: AuthSessionFixture = {
  userId: createId("user", 1),
  issuer: "https://auth.example.com",
};

export function createAuthSession(
  overrides?: Partial<AuthSessionFixture>
): AuthSessionFixture {
  return createFixture(defaultAuthSession, overrides);
}
