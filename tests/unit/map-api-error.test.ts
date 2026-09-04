/**
 * Unit tests for mapApiErrorToTRPC and withPolymarketError.
 */
import { describe, expect, it } from "vitest";
import {
  ApiError,
  ErrorCode,
  mapApiErrorToTRPC,
  withPolymarketError,
} from "../../apps/server/src/lib/errors";

describe("mapApiErrorToTRPC", () => {
  function createApiError(code: ErrorCode, httpStatus?: number): ApiError {
    return new ApiError({
      code,
      httpStatus: httpStatus ?? null,
      source: "gamma",
      path: "/markets",
      retryable: false,
      retryDelayMs: null,
    });
  }

  it("maps AUTH to UNAUTHORIZED", () => {
    const err = mapApiErrorToTRPC(createApiError(ErrorCode.AUTH, 401));
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toContain("verify");
  });

  it("maps RATE_LIMIT to TOO_MANY_REQUESTS", () => {
    const err = mapApiErrorToTRPC(createApiError(ErrorCode.RATE_LIMIT, 429));
    expect(err.code).toBe("TOO_MANY_REQUESTS");
    expect(err.message).toContain("Too many");
  });

  it("maps SERVER to INTERNAL_SERVER_ERROR", () => {
    const err = mapApiErrorToTRPC(createApiError(ErrorCode.SERVER, 500));
    expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    expect(err.message).toContain("temporarily unavailable");
  });

  it("maps NETWORK to INTERNAL_SERVER_ERROR", () => {
    const err = mapApiErrorToTRPC(createApiError(ErrorCode.NETWORK));
    expect(err.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("maps UNKNOWN with 404 to NOT_FOUND", () => {
    const err = mapApiErrorToTRPC(createApiError(ErrorCode.UNKNOWN, 404));
    expect(err.code).toBe("NOT_FOUND");
  });

  it("maps UNKNOWN without 404 to INTERNAL_SERVER_ERROR", () => {
    const err = mapApiErrorToTRPC(createApiError(ErrorCode.UNKNOWN, 400));
    expect(err.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("maps VALIDATION to BAD_REQUEST", () => {
    const err = mapApiErrorToTRPC(
      new ApiError({
        code: ErrorCode.VALIDATION,
        httpStatus: 400,
        source: "gamma",
        path: "/events",
        retryable: false,
        retryDelayMs: null,
        message: "Invalid slug format",
      })
    );
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid slug format");
  });
});

describe("withPolymarketError", () => {
  it("returns value when fn resolves", async () => {
    const result = await withPolymarketError(async () => "ok");
    expect(result).toBe("ok");
  });

  it("rethrows mapped TRPCError when fn throws ApiError", async () => {
    const apiErr = new ApiError({
      code: ErrorCode.AUTH,
      httpStatus: 401,
      source: "gamma",
      path: "/markets",
      retryable: false,
      retryDelayMs: null,
    });
    await expect(
      withPolymarketError(() => {
        throw apiErr;
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rethrows non-ApiError unchanged", async () => {
    const customErr = new Error("Custom error");
    await expect(
      withPolymarketError(() => {
        throw customErr;
      })
    ).rejects.toThrow("Custom error");
  });
});
