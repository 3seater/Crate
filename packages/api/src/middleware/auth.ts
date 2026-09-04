import { db, isSessionRevoked } from "@doji/db";
import { TRPCError } from "@trpc/server";

import { publicProcedure } from "../index";
import { verifySessionToken } from "../lib/session";
import { t } from "../trpc";

/**
 * Extracts a Bearer token from the Authorization header value.
 *
 * @returns The raw token string, or `null` if the header is missing or malformed.
 */
const extractBearerToken = (header: string | undefined): string | null => {
  if (!header) {
    return null;
  }
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }
  return parts[1] ?? null;
};

/**
 * tRPC middleware that enforces authentication on protected procedures.
 *
 * 1. Reads the `Authorization: Bearer <token>` header from the Hono request context.
 * 2. Verifies the JWT session token via {@link verifySessionToken}.
 * 3. Attaches `{ userId, issuer }` to the tRPC context as `session`.
 * 4. Throws `TRPCError` with code `UNAUTHORIZED` when the token is missing,
 *    malformed, or fails verification (invalid / expired).
 *
 * @see Requirements 2.3, 2.4, 2.5
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  // Allow pre-set session from createContextInner (e.g. tests, server-side callers)
  if (ctx.session != null) {
    return next({ ctx: { ...ctx, session: ctx.session } });
  }

  const authHeader = ctx.honoContext.req.header("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing or malformed Authorization header",
    });
  }

  try {
    const session = await verifySessionToken(token);

    // Check blocklist — reject revoked tokens (e.g. after logout)
    let revoked: boolean;
    try {
      revoked = await isSessionRevoked(db, session.jti);
    } catch {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Authentication service unavailable",
      });
    }
    if (revoked) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session has been revoked",
      });
    }

    return next({
      ctx: {
        ...ctx,
        session: {
          userId: session.userId,
          issuer: session.issuer,
          jti: session.jti,
          exp: session.exp,
        },
      },
    });
  } catch (err) {
    if (err instanceof TRPCError) {
      throw err;
    }
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or expired session token",
    });
  }
});

/**
 * A tRPC procedure that requires a valid session token.
 *
 * The resolved context is guaranteed to contain a non-null `session`
 * with `{ userId, issuer }` fields.
 */
export const protectedProcedure = publicProcedure.use(authMiddleware);
