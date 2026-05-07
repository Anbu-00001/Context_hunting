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
import { Devvit } from "@devvit/public-api";

Devvit.configure({
  http: true,
});

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

export async function dispatchToN8N(postData: FlaggedPostPayload) {
  // Evaluated at runtime, safe for Devvit's execution context
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  console.log(
    `[QUORUM] Dispatching post ${postData.postId} → N8N`,
  );

  // MOCK MODE: Bypass actual fetch while waiting for Devvit Admin Domain Approval
  console.log(`[QUORUM MOCK] Webhook payload intercepted:`, postData);
  return {
    success: true,
    executionId: "mock-execution-id",
    message: "Mocked locally due to pending Devvit domain approval"
  } as N8NWebhookResponse;

  /*
  try {
    const response = await fetch('https://unpledged-unwed-aloft.ngrok-free.dev/webhook-test/58f7d84c-45e1-4f21-8959-32c59f1bd6a6', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true'
      },
      body: JSON.stringify(postData)
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
  */
}
