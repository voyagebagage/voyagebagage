"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import webpush from "web-push";
import { themeNotification } from "./notificationThemes";

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
    // The human who triggered this push (if any). Enables per-person theming.
    fromMemberId: v.optional(v.id("members")),
  },
  handler: async (ctx, args) => {
    configureVapid();
    const subs = await ctx.runQuery(internal.subscriptions.listForMember, {
      memberId: args.memberId,
    });

    // Look up names so we can theme the notification per recipient/sender.
    const recipient = await ctx.runQuery(internal.families.getMemberInternal, {
      id: args.memberId,
    });
    const sender = args.fromMemberId
      ? await ctx.runQuery(internal.families.getMemberInternal, {
          id: args.fromMemberId,
        })
      : null;

    const view = themeNotification({
      title: args.title,
      body: args.body,
      senderName: sender?.name,
      recipientName: recipient?.name,
    });

    const payload = JSON.stringify({
      title: view.title,
      body: view.body,
      icon: view.icon,
      badge: view.badge,
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
