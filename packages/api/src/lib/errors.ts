/**
 * Structured app errors for user-facing and operational clarity.
 * Use `new AppError(...)` instead of `throw new Error(...)` or `new TRPCError(...)` for critical flows
 * so the client can display message, why, fix, and link in toasts or inline UI.
 *
 * Client usage: Use error.data.message, error.data.why, error.data.fix, error.data.link
 * for display. Use getTrpcDisplayMessage(error) on the web app.
 *
 * @see .cursor/skills/review-logging-patterns
 */

import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

export interface AppErrorOptions {
  cause?: unknown;
  code?: TRPC_ERROR_CODE_KEY;
  fix?: string;
  link?: string;
  message: string;
  why?: string;
}

/**
 * Structured TRPCError with optional why/fix/link for rich client UX.
 * The errorFormatter in trpc.ts extracts these fields into shape.data.
 *
 * Prefer `throw new AppError(...)` over `throw new TRPCError(...)` when
 * the error benefits from user-facing context (why it happened, how to fix it).
 *
 * @example
 * throw new AppError({
 *   code: "PRECONDITION_FAILED",
 *   message: "Insufficient balance",
 *   why: "Your pUSD balance is below the minimum order size of $1",
 *   fix: "Deposit more USDC to your trading wallet",
 *   link: "/bridge",
 * });
 */
export class AppError extends TRPCError {
  readonly why?: string;
  readonly fix?: string;
  readonly link?: string;

  constructor(opts: AppErrorOptions) {
    const {
      message,
      code = "INTERNAL_SERVER_ERROR",
      why,
      fix,
      link,
      cause,
    } = opts;
    super({ code, message, cause });
    this.why = why;
    this.fix = fix;
    this.link = link;
  }
}
