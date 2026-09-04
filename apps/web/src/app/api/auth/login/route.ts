import { NextResponse } from "next/server";

const COOKIE_NAME = "crate_access";
// 7 days
const MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string };

  if (password !== "54321") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
