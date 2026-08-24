"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Cadence's own email pipeline — Resend templates + transactional sends.
 *
 * Templates live in YOUR Resend dashboard (currently "Welcome Email",
 * alias `welcome-email`). The alias is resolved at send time, so the template
 * can be redesigned in the dashboard without touching code.
 *
 * OTP behavior: if the template defines a `CODE` variable, OTPs are sent
 * through the template; otherwise a built-in branded code card is used so
 * sign-in never depends on dashboard changes.
 *
 * Env vars:
 *   RESEND_API_KEY  (required) — resend.com API key
 *   MAIL_FROM       (optional) — "Cadence <sign-in@yourdomain.com>"
 */

const RESEND_API = "https://api.resend.com";
const TEMPLATE_ALIAS = "welcome-email";

function authHeaders(): Record<string, string> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Email delivery isn't configured. Add RESEND_API_KEY (free at resend.com) in the project's keys settings.",
    );
  }
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

function fromAddress(): string {
  return process.env.MAIL_FROM ?? "Cadence <Siba@unifies.codes>";
}

/** Resolve the template alias to its current published id + metadata. */
async function resolveTemplate(): Promise<{
  id: string;
  variables: string[];
  subject?: string;
  from?: string;
}> {
  const res = await fetch(`${RESEND_API}/templates/${TEMPLATE_ALIAS}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Template "${TEMPLATE_ALIAS}" not reachable (HTTP ${res.status})`);
  }
  const t = (await res.json()) as {
    id: string;
    variables?: { name?: string }[] | string[];
    subject?: string;
    from?: string;
  };
  const variables = (t.variables ?? []).map((v) =>
    typeof v === "string" ? v : (v.name ?? ""),
  );
  return { id: t.id, variables, subject: t.subject, from: t.from };
}

async function send(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Couldn't send email (HTTP ${res.status}). ${detail.slice(0, 200)}`,
    );
  }
}

function firstNameFor(email: string, name?: string): string {
  const n = (name ?? "").trim();
  if (n) return n.split(/\s+/)[0];
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._\-+\d]+/g, " ").trim();
  return cleaned
    ? cleaned
        .split(/\s+/)[0]
        .charAt(0)
        .toUpperCase() + cleaned.split(/\s+/)[0].slice(1)
    : "there";
}

/** Branded built-in code card — the guaranteed fallback for OTP delivery. */
function otpCardHtml(code: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="display:inline-block;font-size:22px;font-weight:700;color:#1c1917;letter-spacing:-0.5px;">Cadence</span>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:20px;padding:32px;text-align:center;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#1c1917;">Find your pace</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#78716c;">Enter this code to sign in — it expires in 15 minutes.</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px 0;margin:0 8px;">${code}</div>
      <p style="margin:24px 0 0;font-size:12px;color:#a8a29e;">Didn't request this? Ignore it — nothing changes without the code.</p>
    </div>
    <p style="text-align:center;font-size:11px;color:#a8a29e;margin-top:20px;">Cadence · a pace you can actually keep</p>
  </div>
</body></html>`;
}

/**
 * Send the sign-in code. Uses the Resend template when it exposes a CODE
 * variable (edit the template in the dashboard to opt in), otherwise the
 * built-in branded card.
 */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  let template: Awaited<ReturnType<typeof resolveTemplate>> | null = null;
  try {
    template = await resolveTemplate();
  } catch {
    template = null;
  }

  if (template && template.variables.includes("CODE")) {
    await send({
      from: process.env.MAIL_FROM ?? template.from ?? fromAddress(),
      to: [email],
      template: {
        id: template.id,
        variables: {
          FIRST_NAME: firstNameFor(email),
          CODE: code,
        },
      },
    });
    return;
  }

  await send({
    from: fromAddress(),
    to: [email],
    subject: `Cadence sign-in code: ${code}`,
    html: otpCardHtml(code),
    text: `Your Cadence sign-in code is ${code} (expires in 15 minutes).`,
  });
}

/** Welcome the new human with the dashboard-designed template. */
export async function sendWelcomeEmail(
  email: string,
  name?: string,
): Promise<void> {
  const template = await resolveTemplate();
  await send({
    from: process.env.MAIL_FROM ?? template.from ?? fromAddress(),
    to: [email],
    template: {
      id: template.id,
      variables: {
        FIRST_NAME: firstNameFor(email, name),
      },
    },
  });
}

/** Scheduled by the auth hook after a brand-new account is created. */
export const sendWelcomeAction = action({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (_ctx, args) => {
    try {
      await sendWelcomeEmail(args.email, args.name);
    } catch (err) {
      // A failed welcome must never break the sign-up that triggered it.
      console.error("[mailer] welcome email failed:", err);
    }
  },
});
