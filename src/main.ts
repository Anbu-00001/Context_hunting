/**
 * ──────────────────────────────────────────────────────────
 *  QUORUM — src/main.ts
 *  Phase 2: Intelligence — N8N Webhook Dispatcher
 * ──────────────────────────────────────────────────────────
 *
 *  This module is the bridge between the Devvit server layer
 *  and the external N8N orchestration pipeline. When a post
 *  is flagged (or any qualifying event fires), the server
 *  calls `dispatchToN8N()` to push a payload to the webhook.
 *
 *  Environment dependency:
 *    N8N_WEBHOOK_URL  — set in .env at project root
 * ──────────────────────────────────────────────────────────
 */

// ── Types ────────────────────────────────────────────────

/** Payload sent to the N8N webhook when a post is flagged. */
export interface FlaggedPostPayload {
  /** Reddit post ID (t3_xxxxx format) */
  postId: string;
  /** Subreddit where the flag originated */
  subreddit: string;
  /** Title of the flagged post */
  title: string;
  /** Username of the post author */
  author: string;
  /** ISO-8601 timestamp of when the flag was raised */
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
 * Throws immediately on startup if the variable is missing,
 * so we fail fast rather than silently dropping payloads.
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
 * Sends a flagged-post payload to the N8N orchestration webhook.
 *
 * @param payload - The flagged post data to dispatch.
 * @returns The parsed response from N8N, or `null` if the call failed.
 *
 * @example
 * ```ts
 * import { dispatchToN8N } from "../main.ts";
 *
 * const result = await dispatchToN8N({
 *   postId:    "t3_abc123",
 *   subreddit: "testQuorum",
 *   title:     "Suspicious post title",
 *   author:    "some_user",
 *   flaggedAt: new Date().toISOString(),
 *   reason:    "style_break_detected",
 * });
 * ```
 */
export async function dispatchToN8N(
  payload: FlaggedPostPayload,
): Promise<N8NWebhookResponse | null> {
  const webhookUrl = getWebhookUrl();

  console.log(
    `[QUORUM] Dispatching flagged post ${payload.postId} → N8N`,
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
      console.error(
        `[QUORUM] N8N webhook returned HTTP ${response.status}: ` +
          `${response.statusText}`,
      );
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
    return null;
  }
}

// ── Quick self-test (run with: npx tsx src/main.ts) ──────

const isCLI =
  typeof process !== "undefined" &&
  process.argv[1]?.endsWith("main.ts");

if (isCLI) {
  // Load .env for standalone testing
  const { config } = await import("dotenv");
  config();

  console.log("[QUORUM] Self-test — sending test payload to N8N…");

  const testPayload: FlaggedPostPayload = {
    postId: "t3_test_001",
    subreddit: "testQuorum",
    title: "Self-test post from src/main.ts",
    author: "quorum_bot",
    flaggedAt: new Date().toISOString(),
    reason: "self_test",
  };

  const result = await dispatchToN8N(testPayload);

  if (result) {
    console.log("[QUORUM] ✅ Self-test passed:", JSON.stringify(result));
  } else {
    console.log("[QUORUM] ❌ Self-test failed — check N8N / tunnel status.");
  }
}
