import {
  mutation,
  query,
  internalQuery,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { newToken, normalizeCode, requireMember } from "./lib";

const EMOJIS = ["🐢", "🦊", "🐼", "🐙", "🦉", "🐝", "🦄", "🐳", "🦔", "🐧"];

/** Create a brand new family and join it as the first member. */
export const createFamily = mutation({
  args: {
    familyName: v.string(),
    code: v.string(),
    memberName: v.string(),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = normalizeCode(args.code);
    if (code.length < 4) {
      throw new Error("Family code must be at least 4 characters.");
    }
    const existing = await ctx.db
      .query("families")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (existing) {
      throw new Error("That family code is taken. Pick another.");
    }
    const familyId = await ctx.db.insert("families", {
      name: args.familyName.trim() || "Our Family",
      code,
      createdAt: Date.now(),
    });
    return joinAsMember(ctx, familyId, args.memberName, args.emoji);
  },
});

/** Join an existing family using its code. */
export const joinFamily = mutation({
  args: {
    code: v.string(),
    memberName: v.string(),
    emoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const code = normalizeCode(args.code);
    const family = await ctx.db
      .query("families")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!family) {
      throw new Error("No family found with that code.");
    }
    return joinAsMember(ctx, family._id, args.memberName, args.emoji);
  },
});

async function joinAsMember(
  ctx: MutationCtx,
  familyId: Id<"families">,
  memberName: string,
  emoji?: string,
) {
  const name = memberName.trim();
  if (!name) throw new Error("Please enter your name.");
  const token = newToken();
  const memberId = await ctx.db.insert("members", {
    familyId,
    name,
    emoji: emoji || EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    token,
    createdAt: Date.now(),
    lastSeen: Date.now(),
  });
  return { token, memberId, familyId };
}

/** Who am I + my family + my teammates. Drives the whole authed UI. */
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!member) return null;
    const family = await ctx.db.get(member.familyId);
    const members = await ctx.db
      .query("members")
      .withIndex("by_family", (q) => q.eq("familyId", member.familyId))
      .collect();
    return {
      member,
      family,
      members: members.map((m) => ({
        _id: m._id,
        name: m.name,
        emoji: m.emoji,
      })),
    };
  },
});

/** Internal: fetch a member by id (used by the push-sender to theme messages). */
export const getMemberInternal = internalQuery({
  args: { id: v.id("members") },
  handler: (ctx, { id }) => ctx.db.get(id),
});

/** Touch lastSeen so we know who's active (used by daily-summary cron). */
export const heartbeat = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const member = await requireMember(ctx, token);
    await ctx.db.patch(member._id, { lastSeen: Date.now() });
  },
});
