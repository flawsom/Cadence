import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { sendOtpEmail } from "../mailer";

/**
 * OTP delivery through YOUR OWN email account — no platform mail service.
 *
 * Uses your Resend account (free forever tier: 3,000 emails/month, no credit
 * card). Configure with two environment variables:
 *   RESEND_API_KEY  — from resend.com → API Keys
 *   MAIL_FROM       — optional, e.g. "Cadence <sign-in@yourdomain.com>"
 *
 * The "Welcome Email" template is used automatically once it exposes a CODE
 * variable; until then a built-in branded code card is sent.
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
    await sendOtpEmail(email, token);
  },
});
