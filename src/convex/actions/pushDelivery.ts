/**
 * Push delivery via Firebase Cloud Messaging V1 API.
 *
 * Uses the FCM V1 HTTP API directly (no Firebase Admin SDK dependency).
 * Authenticates with a service account JWT signed using Node.js crypto.
 *
 * Env vars (set in Convex Dashboard → Settings → Environment variables):
 *   FIREBASE_PROJECT_ID  — e.g. "cadence-d9843"
 *   FIREBASE_CLIENT_EMAIL — service account email
 *   FIREBASE_PRIVATE_KEY  — PEM private key (with \\n escaped)
 */
"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { createSign } from "node:crypto";

const FCM_SCOPES = "https://www.googleapis.com/auth/firebase.messaging";

/**
 * Generate a short-lived OAuth2 access token from the service account
 * using Node.js built-in crypto (no external JWT library needed).
 */
async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY env vars. " +
      "Set them in Convex Dashboard → Settings → Environment variables.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: FCM_SCOPES,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(privateKey, "base64url");

  const token = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get access token: ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Send a push notification via FCM V1.
 */
async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<{ success: boolean; error?: string }> {
  const endpointParts = subscription.endpoint.split("/");
  const token = endpointParts[endpointParts.length - 1];

  const message = {
    token,
    webpush: {
      notification: {
        title: payload.title,
        body: payload.body,
        icon: "/logo.svg",
        badge: "/logo.svg",
        tag: payload.tag || "cadence",
      },
      fcm_options: {
        link: payload.url,
      },
      headers: {
        TTL: "86400",
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: err };
  }

  return { success: true };
}

/**
 * Action: Send push notifications to a list of subscriptions.
 */
export const sendPushBatch = action({
  args: {
    subscriptions: v.array(
      v.object({
        endpoint: v.string(),
        p256dh: v.string(),
        auth: v.string(),
      }),
    ),
    payload: v.object({
      title: v.string(),
      body: v.string(),
      url: v.string(),
      tag: v.optional(v.string()),
    }),
  },
  handler: async (_ctx, args) => {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error("Missing FIREBASE_PROJECT_ID env var");
    }

    if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      return { sent: 0, failed: 0, skipped: args.subscriptions.length, reason: "credentials_not_configured" };
    }

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (err) {
      throw new Error(`Firebase auth failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    let sent = 0;
    let failed = 0;

    for (const sub of args.subscriptions) {
      try {
        const result = await sendFcmMessage(accessToken, projectId, sub, {
          title: args.payload.title,
          body: args.payload.body,
          url: args.payload.url,
          tag: args.payload.tag,
        });
        if (result.success) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  },
});
