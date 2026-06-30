"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import webpush from "web-push";

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:family@example.com";
  if (!publicKey || !privateKey) {
    throw new Error(
      "Missing VAPID keys. Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in Convex env.",
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Send one notification to every device a member has registered.
 * Dead subscriptions (410/404) are pruned automatically.
 */
export const notifyMember = internalAction({
  args: {
    memberId: v.id("members"),
    title: v.string(),
    body: v.string(),
    url: v.optional(v.string()),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    configureVapid();
    const subs = await ctx.runQuery(internal.subscriptions.listForMember, {
      memberId: args.memberId,
    });
    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url ?? "/",
      tag: args.tag,
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          const statusCode =
            err && typeof err === "object" && "statusCode" in err
              ? (err as { statusCode: number }).statusCode
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription is gone for good — stop trying to reach it.
            await ctx.runMutation(internal.subscriptions.deleteByEndpoint, {
              endpoint: sub.endpoint,
            });
          } else {
            console.error("web-push failed", statusCode, err);
          }
        }
      }),
    );
  },
});
