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

export interface FlaggedPostPayload {
  postId: string;
  title: string;
  author: string;
  timestamp: number;
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

// ── Dispatcher ───────────────────────────────────────────

export async function dispatchToN8N(payload: FlaggedPostPayload) {
  // Evaluated at runtime, safe for Devvit's execution context
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    const error = new Error("N8N_WEBHOOK_URL is missing in the environment");
    Sentry.captureException(error);
    throw error;
  }

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
