import { NextResponse } from "next/server";

const STATUS_JSON_URL = "https://status.doji.bet/index.json";

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(STATUS_JSON_URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `status upstream returned ${response.status}` },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as unknown;

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "status upstream unreachable" },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
