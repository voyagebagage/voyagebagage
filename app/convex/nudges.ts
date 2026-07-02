import { internalMutation, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Members who should hear about a task: the assignee, else the whole family. */
async function recipients(
  ctx: MutationCtx,
  todo: Doc<"todos">,
): Promise<Id<"members">[]> {
  if (todo.assigneeId) return [todo.assigneeId];
  const members = await ctx.db
    .query("members")
    .withIndex("by_family", (q) => q.eq("familyId", todo.familyId))
    .collect();
  return members.map((m) => m._id);
}

function ago(ms: number): string {
  if (ms >= WEEK) return "for over a week";
  if (ms >= DAY) return `for ${Math.floor(ms / DAY)} day(s)`;
  if (ms >= HOUR) return `for ${Math.floor(ms / HOUR)} hour(s)`;
  return "for a little while";
}

/** Ping about tasks whose due date has passed (at most once every 12h). */
export const runOverdueNudges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db
      .query("todos")
      .filter((q) => q.eq(q.field("done"), false))
      .collect();
    for (const todo of open) {
      if (!todo.dueAt || todo.dueAt > now) continue;
      if (todo.lastOverdueNudge && now - todo.lastOverdueNudge < 12 * HOUR) {
        continue;
      }
      const overdueBy = ago(now - todo.dueAt);
      for (const memberId of await recipients(ctx, todo)) {
        await ctx.scheduler.runAfter(0, internal.push.notifyMember, {
          memberId,
          title: "⏰ This is overdue",
          body: `"${todo.title}" has been overdue ${overdueBy}.`,
          url: "/",
          tag: `overdue-${todo._id}`,
        });
      }
      await ctx.db.patch(todo._id, { lastOverdueNudge: now });
    }
  },
});

/** Tease about tasks that have just been sitting there (once per day). */
export const runStaleNudges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db
      .query("todos")
      .filter((q) => q.eq(q.field("done"), false))
      .collect();
    for (const todo of open) {
      const age = now - todo.createdAt;
      if (age < DAY) continue; // give it at least a day
      if (todo.lastStaleNudge && now - todo.lastStaleNudge < DAY) continue;
      const tease =
        age >= WEEK
          ? `You still haven't done "${todo.title}" — it's been a whole week! 😬`
          : `Psst… "${todo.title}" is still waiting since yesterday. 👀`;
      for (const memberId of await recipients(ctx, todo)) {
        await ctx.scheduler.runAfter(0, internal.push.notifyMember, {
          memberId,
          title: "👀 Gentle nudge",
          body: tease,
          url: "/",
          tag: `stale-${todo._id}`,
        });
      }
      await ctx.db.patch(todo._id, { lastStaleNudge: now });
    }
  },
});

/** Morning roundup: how many open tasks each person has today. */
export const runDailySummary = internalMutation({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("members").collect();
    for (const member of members) {
      const hasPush = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_member", (q) => q.eq("memberId", member._id))
        .first();
      if (!hasPush) continue;
      const open = await ctx.db
        .query("todos")
        .withIndex("by_family_done", (q) =>
          q.eq("familyId", member.familyId).eq("done", false),
        )
        .collect();
      const mine = open.filter(
        (t) => t.assigneeId === member._id || !t.assigneeId,
      );
      if (mine.length === 0) continue;
      await ctx.scheduler.runAfter(0, internal.push.notifyMember, {
        memberId: member._id,
        title: `☀️ Good morning, ${member.name}`,
        body:
          mine.length === 1
            ? `You have 1 thing on your list: "${mine[0].title}".`
            : `You have ${mine.length} things on your list today.`,
        url: "/",
        tag: "daily-summary",
      });
    }
  },
});
