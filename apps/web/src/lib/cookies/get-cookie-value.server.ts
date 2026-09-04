import "server-only";

import { cookies } from "next/headers";

export async function getCookieValueServer(
  name: string
): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(name)?.value;
}
