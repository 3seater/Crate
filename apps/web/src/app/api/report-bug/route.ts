/**
 * In-app bug report endpoint.
 *
 * Accepts multipart/form-data with:
 *   - `message` (string, required): user's bug description
 *   - `context` (JSON string, optional): `{ url, userAgent, viewport, userId, email, address, safeAddress, authMethod, chainId, hasCredentials, appVersion, timestamp }`
 *   - `image{n}` (File, optional, 0..MAX_IMAGES): attached screenshots / media
 *
 * Forwards to Discord via the webhook URL in `DISCORD_BUG_REPORT_WEBHOOK_URL`
 * using Discord's native multipart format (`payload_json` + `files[n]`).
 *
 * Kept server-only so the webhook URL is never exposed to the browser and
 * cannot be abused from arbitrary origins.
 */

import { env } from "@doji/env/web";
import { logger } from "@doji/logger";
import {
  captureException,
  captureMessage,
  getIsolationScope,
} from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { AnalyticsEvents } from "@/lib/analytics/analytics-events";
import { trackWebEventOnServer } from "@/lib/analytics/track-server";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per image
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB total
const MAX_MESSAGE_CHARS = 4000; // Discord embed description limit is 4096
const DISCORD_EMBED_FIELD_VALUE_MAX = 1024;
const BUG_REPORT_EMBED_COLOR = 0xed_42_45; // Discord red

interface BugReportContext {
  address?: string | null;
  appVersion?: string | null;
  authMethod?: string | null;
  chainId?: number | string | null;
  email?: string | null;
  hasCredentials?: boolean | null;
  safeAddress?: string | null;
  timestamp?: string;
  url?: string;
  userAgent?: string;
  userId?: string | null;
  viewport?: string;
}

interface DiscordEmbedField {
  inline?: boolean;
  name: string;
  value: string;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function addField(
  fields: DiscordEmbedField[],
  name: string,
  value: string | null | undefined,
  inline = true
) {
  if (value === null || value === undefined || value === "") {
    return;
  }
  fields.push({
    name,
    value: truncate(value, DISCORD_EMBED_FIELD_VALUE_MAX),
    inline,
  });
}

function parseContext(raw: string | null): BugReportContext {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as BugReportContext)
      : {};
  } catch {
    return {};
  }
}

/** Returns the trimmed message (or null if missing/empty). */
function extractMessage(form: FormData): string | null {
  const raw = String(form.get("message") ?? "").trim();
  if (!raw) {
    return null;
  }
  return truncate(raw, MAX_MESSAGE_CHARS);
}

type ImageCollectionResult =
  | { ok: true; images: File[] }
  | { ok: false; error: string; status: number };

/** Pulls `image0..imageN` files from the form and enforces size caps. */
function collectImages(form: FormData): ImageCollectionResult {
  const images: File[] = [];
  let totalBytes = 0;
  for (let i = 0; i < MAX_IMAGES; i++) {
    const entry = form.get(`image${i}`);
    if (!(entry instanceof File) || entry.size === 0) {
      continue;
    }
    if (entry.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        status: 413,
        error: `Attachment "${entry.name}" is larger than 5 MB.`,
      };
    }
    totalBytes += entry.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return {
        ok: false,
        status: 413,
        error: "Total attachment size exceeds 20 MB.",
      };
    }
    images.push(entry);
  }
  return { ok: true, images };
}

function buildEmbedFields(context: BugReportContext): DiscordEmbedField[] {
  const fields: DiscordEmbedField[] = [];
  if (context.url) {
    addField(fields, "URL", context.url, false);
  }
  addField(fields, "User ID", context.userId ?? undefined);
  addField(fields, "Email", context.email ?? undefined);
  addField(fields, "Wallet", context.address ?? undefined);
  addField(fields, "Safe", context.safeAddress ?? undefined);
  addField(fields, "Auth", context.authMethod ?? undefined);
  addField(
    fields,
    "Chain",
    context.chainId == null ? undefined : String(context.chainId)
  );
  if (typeof context.hasCredentials === "boolean") {
    addField(fields, "Credentials", context.hasCredentials ? "yes" : "no");
  }
  addField(fields, "Viewport", context.viewport ?? undefined);
  addField(fields, "App Version", context.appVersion ?? undefined);
  if (context.userAgent) {
    addField(fields, "User Agent", context.userAgent, false);
  }
  return fields;
}

function buildDiscordForm(
  message: string,
  context: BugReportContext,
  images: File[]
): FormData {
  const embed: Record<string, unknown> = {
    title: "New bug report",
    description: message,
    color: BUG_REPORT_EMBED_COLOR,
    fields: buildEmbedFields(context),
    timestamp: context.timestamp ?? new Date().toISOString(),
  };
  if (images.length > 0) {
    // First image shown inline in the embed; remaining images arrive as regular
    // attachments below the embed.
    embed.image = { url: `attachment://${images[0].name}` };
  }

  const payload = {
    username: "Doji Bug Reporter",
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };

  const outgoing = new FormData();
  outgoing.set("payload_json", JSON.stringify(payload));
  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    outgoing.set(`files[${i}]`, file, file.name);
  }
  return outgoing;
}

async function deliverToDiscord(
  webhookUrl: string,
  body: FormData,
  imageCount: number
): Promise<Response> {
  try {
    const response = await fetch(webhookUrl, { method: "POST", body });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.warn(
        { status: response.status, errorBody: errorBody.slice(0, 500) },
        "Bug report: Discord webhook returned non-ok"
      );
      captureMessage("bug_report_webhook_non_ok", {
        level: "warning",
        tags: { route: "/api/report-bug" },
        extra: { status: response.status, body: errorBody.slice(0, 500) },
      });
      return NextResponse.json(
        { ok: false, error: "Failed to deliver report. Please try again." },
        { status: 502 }
      );
    }
    logger.info({ imageCount }, "Bug report delivered to Discord");
    await trackWebEventOnServer(AnalyticsEvents.supportBugReportSubmitted, {
      image_count: imageCount,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "Bug report: Discord webhook fetch failed"
    );
    captureException(err, { tags: { route: "/api/report-bug" } });
    return NextResponse.json(
      { ok: false, error: "Could not reach Discord. Please try again." },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  getIsolationScope().setAttributes({
    section: "bug_report",
    route: "/api/report-bug",
  });

  const webhookUrl = env.DISCORD_BUG_REPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.warn(
      "Bug report received but DISCORD_BUG_REPORT_WEBHOOK_URL is not set"
    );
    return NextResponse.json(
      { ok: false, error: "Bug reporter is not configured." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "Bug report: malformed multipart body"
    );
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const message = extractMessage(form);
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Please describe the bug." },
      { status: 400 }
    );
  }

  const collected = collectImages(form);
  if (!collected.ok) {
    return NextResponse.json(
      { ok: false, error: collected.error },
      { status: collected.status }
    );
  }

  const contextRaw = form.get("context");
  const context = parseContext(
    typeof contextRaw === "string" ? contextRaw : null
  );

  const outgoing = buildDiscordForm(message, context, collected.images);
  return deliverToDiscord(webhookUrl, outgoing, collected.images.length);
}
