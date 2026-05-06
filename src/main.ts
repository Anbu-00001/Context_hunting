/**
 * ──────────────────────────────────────────────────────────
 *  QUORUM — src/main.ts
 *  N8N Webhook Dispatcher (server-side module)
 * ──────────────────────────────────────────────────────────
 *
 *  Pure server module — imported by src/server/server.ts.
 *  No standalone CLI mode, no dotenv dependency.
 *
 *  Environment dependency:
 *    N8N_WEBHOOK_URL  — set in .env at project root
 * ──────────────────────────────────────────────────────────
 */

import * as Sentry from "@sentry/node";

// ── Types ────────────────────────────────────────────────

/** Payload sent to the N8N webhook when a post is submitted. */
export interface FlaggedPostPayload {
  /** Reddit post ID (t3_xxxxx format) */
  postId: string;
  /** Subreddit where the post was submitted */
  subreddit: string;
  /** Title of the post */
  title: string;
  /** Username of the post author */
  author: string;
  /** ISO-8601 timestamp of when the event fired */
  flaggedAt: string;
  /** Optional: reason/category for the flag */
  reason?: string;
}

/** Response shape returned by the N8N webhook. */
export interface N8NWebhookResponse {
  /** Whether N8N acknowledged the payload */
  success: boolean;
  /** Optional execution ID from N8N for tracing */
  executionId?: string;
  /** Optional message from the workflow */
  message?: string;
}

// ── Configuration ────────────────────────────────────────

/**
 * Reads the N8N webhook URL from the environment.
 * Throws immediately if the variable is missing —
 * fail fast rather than silently dropping payloads.
 */
function getWebhookUrl(): string {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url || url.trim().length === 0) {
    throw new Error(
      "[QUORUM] N8N_WEBHOOK_URL is not set. " +
        "Ensure .env is configured at the project root.",
    );
  }
  return url;
}

// ── Dispatcher ───────────────────────────────────────────

/**
 * Sends a payload to the N8N orchestration webhook.
 *
 * @param payload - The post data to dispatch.
 * @returns The parsed response from N8N, or `null` if the call failed.
 */
export async function dispatchToN8N(
  payload: FlaggedPostPayload,
): Promise<N8NWebhookResponse | null> {
  const webhookUrl = getWebhookUrl();

  console.log(
    `[QUORUM] Dispatching post ${payload.postId} → N8N`,
  );

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // LocalTunnel (loca.lt) requires this header to bypass
        // the interstitial "Click to Continue" page.
        "Bypass-Tunnel-Reminder": "true",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const msg =
        `[QUORUM] N8N webhook returned HTTP ${response.status}: ` +
        `${response.statusText}`;
      console.error(msg);
      Sentry.captureMessage(msg, "warning");
      return null;
    }

    const data = (await response.json()) as N8NWebhookResponse;
    console.log(
      `[QUORUM] N8N acknowledged — executionId: ${data.executionId ?? "n/a"}`,
    );
    return data;
  } catch (err) {
    console.error(
      `[QUORUM] Failed to reach N8N webhook: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
    Sentry.captureException(err);
    return null;
  }
}
