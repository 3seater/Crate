import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const buffer = await readFile(join(process.cwd(), "public/favicon.png"));
  return new Response(buffer, {
    headers: { "Content-Type": contentType },
  });
}
