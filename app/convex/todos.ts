import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { requireMember } from "./lib";

/** All todos for my family, newest-relevant first. */
export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const member = await requireMember(ctx, token);
    const todos = await ctx.db
      .query("todos")
      .withIndex("by_family", (q) => q.eq("familyId", member.familyId))
      .collect();
    // Open tasks first (by due date, then newest), done tasks sink to the bottom.
    return todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.done) {
        const ad = a.dueAt ?? Infinity;
        const bd = b.dueAt ?? Infinity;
        if (ad !== bd) return ad - bd;
        return b.createdAt - a.createdAt;
      }
      return (b.doneAt ?? 0) - (a.doneAt ?? 0);
    });
  },
});

export const add = mutation({
  args: {
    token: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    assigneeId: v.optional(v.id("members")),
  },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.token);
    const title = args.title.trim();
    if (!title) throw new Error("Give the task a title.");
    const todoId = await ctx.db.insert("todos", {
      familyId: member.familyId,
      title,
      notes: args.notes?.trim() || undefined,
      done: false,
      dueAt: args.dueAt,
      assigneeId: args.assigneeId,
      createdById: member._id,
      createdAt: Date.now(),
    });
    // If this task was created for someone else, let them know right away.
    if (args.assigneeId && args.assigneeId !== member._id) {
      await ctx.scheduler.runAfter(0, internal.push.notifyMember, {
        memberId: args.assigneeId,
        title: `📝 New task from ${member.name}`,
        body: title,
        url: "/",
        fromMemberId: member._id,
      });
    }
    return todoId;
  },
});

export const toggle = mutation({
  args: { token: v.string(), id: v.id("todos") },
  handler: async (ctx, { token, id }) => {
    const member = await requireMember(ctx, token);
    const todo = await ctx.db.get(id);
    if (!todo || todo.familyId !== member.familyId) {
      throw new Error("Task not found.");
    }
    const done = !todo.done;
    await ctx.db.patch(id, {
      done,
      doneAt: done ? Date.now() : undefined,
      // Clear nudge timers and any pending suggestion when completed.
      lastOverdueNudge: undefined,
      lastStaleNudge: undefined,
      ...(done ? { suggestedToId: undefined, suggestedAt: undefined } : {}),
    });
    // Celebrate a teammate finishing something you asked for.
    if (done && todo.createdById !== member._id) {
      await ctx.scheduler.runAfter(0, internal.push.notifyMember, {
        memberId: todo.createdById,
        title: `✅ ${member.name} finished a task`,
        body: todo.title,
        url: "/",
        fromMemberId: member._id,
      });
    }
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("todos"),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    dueAt: v.optional(v.union(v.number(), v.null())),
    assigneeId: v.optional(v.union(v.id("members"), v.null())),
  },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx, args.token);
    const todo = await ctx.db.get(args.id);
    if (!todo || todo.familyId !== member.familyId) {
      throw new Error("Task not found.");
    }
    const patch: Partial<Doc<"todos">> = {};
    if (args.title !== undefined) {
      const t = args.title.trim();
      if (!t) throw new Error("Title can't be empty.");
      patch.title = t;
    }
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;
    if (args.dueAt !== undefined) patch.dueAt = args.dueAt ?? undefined;
    if (args.assigneeId !== undefined) {
      patch.assigneeId = args.assigneeId ?? undefined;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("todos") },
  handler: async (ctx, { token, id }) => {
    const member = await requireMember(ctx, token);
    const todo = await ctx.db.get(id);
    if (!todo || todo.familyId !== member.familyId) {
      throw new Error("Task not found.");
    }
    await ctx.db.delete(id);
  },
});

/** "Do this next" — assign + ping a teammate with an instant push. */
export const suggest = mutation({
  args: {
    token: v.string(),
    id: v.id("todos"),
    toMemberId: v.id("members"),
  },
  handler: async (ctx, { token, id, toMemberId }) => {
    const member = await requireMember(ctx, token);
    const todo = await ctx.db.get(id);
    if (!todo || todo.familyId !== member.familyId) {
      throw new Error("Task not found.");
    }
    const to = await ctx.db.get(toMemberId);
    if (!to || to.familyId !== member.familyId) {
      throw new Error("That person isn't in your family.");
    }
    await ctx.db.patch(id, {
      assigneeId: toMemberId,
      suggestedToId: toMemberId,
      suggestedById: member._id,
      suggestedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.push.notifyMember, {
      memberId: toMemberId,
      title: `👉 ${member.name} suggests you do this next`,
      body: todo.title,
      url: "/",
      fromMemberId: member._id,
    });
  },
});
