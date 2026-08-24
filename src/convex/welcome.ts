import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { mutation } from "./_generated/server";

/**
 * Sends the Resend "welcome-email" template exactly once per user.
 *
 * Called from the dashboard after sign-in. Idempotent via the
 * `welcomeSentAt` flag — repeat calls (every session) are no-ops, so a
 * failed send is naturally retried on the user's next visit.
 */
export const maybeSendWelcome = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const user = await ctx.db.get(userId);
    if (!user || user.welcomeSentAt !== undefined) return;
    if (!user.email || user.isAnonymous) return;

    // Claim first, then send: concurrent sessions can't double-send.
    await ctx.db.patch(userId, { welcomeSentAt: Date.now() });
    await ctx.scheduler.runAfter(0, api.mailer.sendWelcomeAction, {
      email: user.email,
      name: user.name ?? undefined,
    });
  },
});
