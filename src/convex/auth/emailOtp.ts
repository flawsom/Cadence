import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

/**
 * OTP delivery through YOUR OWN email account — no platform mail service.
 *
 * Uses Resend's plain HTTP API (free forever tier: 3,000 emails/month, no
 * credit card). Configure with two environment variables:
 *   RESEND_API_KEY  — from resend.com → API Keys
 *   MAIL_FROM       — optional, e.g. "Cadence <sign-in@yourdomain.com>"
 *                     (defaults to Resend's test sender for quick starts)
 *
 * Self-hosters can point this at any provider by swapping the fetch call —
 * the contract is one HTTP POST per code.
 */
export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Email delivery isn't configured. Add RESEND_API_KEY (free at resend.com) in the project's keys settings.",
      );
    }
    const from = process.env.MAIL_FROM ?? "Cadence <onboarding@resend.dev>";

    const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="display:inline-block;font-size:22px;font-weight:700;color:#1c1917;letter-spacing:-0.5px;">Cadence</span>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:20px;padding:32px;text-align:center;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#1c1917;">Find your pace</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#78716c;">Enter this code to sign in — it expires in 15 minutes.</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:12px;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:16px 0;margin:0 8px;">${token}</div>
      <p style="margin:24px 0 0;font-size:12px;color:#a8a29e;">Didn't request this? Ignore it — nothing changes without the code.</p>
    </div>
    <p style="text-align:center;font-size:11px;color:#a8a29e;margin-top:20px;">Cadence · a pace you can actually keep</p>
  </div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Cadence sign-in code: ${token}`,
        html,
        text: `Your Cadence sign-in code is ${token} (expires in 15 minutes).`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Couldn't send the sign-in email (HTTP ${res.status}). ${detail.slice(0, 200)}`,
      );
    }
  },
});
