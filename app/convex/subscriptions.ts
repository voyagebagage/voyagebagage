import { mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireMember } from "./lib";

/** Store (or refresh) this device's Web Push subscription for the member. */
export const save = mutation({
  args: {
    token: v.string(),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.token);
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        memberId: member._id,
        familyId: member.familyId,
        p256dh: args.p256dh,
        auth: args.auth,
      });
      return;
    }
    await ctx.db.insert("pushSubscriptions", {
      memberId: member._id,
      familyId: member.familyId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: Date.now(),
    });
  },
});

/** Remove this device's subscription (e.g. user turns notifications off). */
export const remove = mutation({
  args: { token: v.string(), endpoint: v.string() },
  handler: async (ctx, { token, endpoint }) => {
    await requireMember(ctx, token);
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (sub) await ctx.db.delete(sub._id);
  },
});

// ---- internal helpers used by the Node push-sender action ----

export const listForMember = internalQuery({
  args: { memberId: v.id("members") },
  handler: (ctx, { memberId }) =>
    ctx.db
      .query("pushSubscriptions")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .collect(),
});

export const deleteByEndpoint = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, { endpoint }) => {
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (sub) await ctx.db.delete(sub._id);
  },
});
