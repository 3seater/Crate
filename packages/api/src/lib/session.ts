import { randomUUID } from "node:crypto";
import { env } from "@doji/env/server";
import type { AuthSession, AuthSessionInput } from "@doji/types";
import * as jose from "jose";

const secret = new TextEncoder().encode(env.JWT_SESSION_SECRET);
const ALG = "HS256";
const DEFAULT_EXPIRATION = "7d";

export interface SessionPayload extends AuthSession {
  exp: number;
  iat: number;
  jti: string;
}

export async function createSessionToken(
  payload: AuthSessionInput,
  expiration: string = DEFAULT_EXPIRATION
): Promise<string> {
  return await new jose.SignJWT({
    userId: payload.userId,
    issuer: payload.issuer,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .setJti(randomUUID())
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload> {
  const { payload } = await jose.jwtVerify(token, secret);

  return {
    userId: payload.userId as string,
    issuer: payload.issuer as string,
    jti: payload.jti as string,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}
