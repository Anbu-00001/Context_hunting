import type { IncomingMessage, ServerResponse } from "node:http";
import * as Sentry from "@sentry/node";
import { context, reddit, redis } from "@devvit/web/server";
import type {
  OnPostSubmitRequest,
  PartialJsonValue,
  TriggerResponse,
  UiResponse,
} from "@devvit/web/shared";
import {
  ApiEndpoint,
} from "../shared/api.ts";
import { dispatchToN8N } from "../main.ts";
import { once } from "node:events";

export async function serverOnRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  try {
    await onRequest(req, rsp);
  } catch (err) {
    const msg = `server error; ${err instanceof Error ? err.stack : err}`;
    console.error(msg);
    Sentry.captureException(err);
    writeJSON<ErrorResponse>(500, { error: msg, status: 500 }, rsp);
  }
}

async function onRequest(
  req: IncomingMessage,
  rsp: ServerResponse,
): Promise<void> {
  const url = req.url;

  if (!url || url === "/") {
    writeJSON<ErrorResponse>(404, { error: "not found", status: 404 }, rsp);
    return;
  }

  const endpoint = url as ApiEndpoint;

  let body: UiResponse | TriggerResponse | ErrorResponse;
  switch (endpoint) {
    case ApiEndpoint.OnPostCreate:
      body = await onMenuNewPost();
      break;
    case ApiEndpoint.OnAppInstall:
      body = await onAppInstall();
      break;
    case ApiEndpoint.OnPostSubmit:
      body = await onPostSubmit(req);
      break;
    default:
      endpoint satisfies never;
      body = { error: "not found", status: 404 };
      break;
  }

  writeJSON<PartialJsonValue>("status" in body ? body.status : 200, body, rsp);
}

type ErrorResponse = {
  error: string;
  status: number;
};

async function onMenuNewPost(): Promise<UiResponse> {
  const post = await reddit.submitCustomPost({ title: context.appName });
  return {
    showToast: { text: `Post ${post.id} created.`, appearance: "success" },
    navigateTo: post.url,
  };
}

async function onAppInstall(): Promise<TriggerResponse> {
  await reddit.submitCustomPost({
    title: "quorum-int",
  });

  return {};
}

// ── PostSubmit Trigger Handler ───────────────────────────
// Fires every time a new post is submitted in the subreddit.
// Reads the trigger payload and dispatches it to the N8N
// orchestration webhook for analysis.
async function onPostSubmit(req: IncomingMessage): Promise<TriggerResponse> {
  const triggerData = await readJSON<OnPostSubmitRequest>(req);

  const postId = triggerData.post?.id ?? "unknown";
  const title = triggerData.post?.title ?? "No Title";
  const author = triggerData.author?.name ?? "AutoModerator";

  console.log(`[QUORUM] PostSubmit trigger fired — post=${postId}`);

  // Fire-and-forget: dispatch to N8N but don't block the trigger response.
  // Errors are captured by Sentry inside dispatchToN8N.
  dispatchToN8N({
    postId,
    title,
    author,
    timestamp: Date.now(),
  }).catch((err) => {
    console.error(`[QUORUM] dispatchToN8N background error:`, err);
    Sentry.captureException(err);
  });

  return {};
}

function writeJSON<T extends PartialJsonValue>(
  status: number,
  json: Readonly<T>,
  rsp: ServerResponse,
): void {
  const body = JSON.stringify(json);
  const len = Buffer.byteLength(body);
  rsp.writeHead(status, {
    "Content-Length": len,
    "Content-Type": "application/json",
  });
  rsp.end(body);
}

async function readJSON<T>(req: IncomingMessage): Promise<T> {
  const chunks: Uint8Array[] = [];
  req.on("data", (chunk) => chunks.push(chunk));
  await once(req, "end");
  return JSON.parse(`${Buffer.concat(chunks)}`);
}
