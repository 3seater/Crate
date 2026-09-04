import { initTRPC } from "@trpc/server";
import { flattenError, ZodError } from "zod";

import type { Context } from "./context";
import { AppError } from "./lib/errors";

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const zodError =
      error.code === "BAD_REQUEST" && error.cause instanceof ZodError
        ? flattenError(error.cause)
        : undefined;
    const appErr = error instanceof AppError ? error : null;
    // Fallback: duck-typing for errors created before AppError class existed
    const legacyErr =
      !appErr && ("why" in error || "fix" in error || "link" in error)
        ? (error as { why?: string; fix?: string; link?: string })
        : null;
    const errData = appErr ?? legacyErr;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError,
        ...(errData?.why !== undefined && { why: errData.why }),
        ...(errData?.fix !== undefined && { fix: errData.fix }),
        ...(errData?.link !== undefined && { link: errData.link }),
      },
    };
  },
});
