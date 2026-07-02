import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  families: defineTable({
    name: v.string(),
    // Lowercased join code. Anyone with this code can join the family.
    code: v.string(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  members: defineTable({
    familyId: v.id("families"),
    name: v.string(),
    emoji: v.string(),
    // Per-device session secret. Returned to the client on join and stored in
    // localStorage; every query/mutation passes it back to identify the member.
    token: v.string(),
    createdAt: v.number(),
    lastSeen: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_family", ["familyId"]),

  todos: defineTable({
    familyId: v.id("families"),
    title: v.string(),
    notes: v.optional(v.string()),
    done: v.boolean(),
    doneAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    assigneeId: v.optional(v.id("members")),
    createdById: v.id("members"),
    createdAt: v.number(),
    // "Suggest this next" — set when someone nudges a teammate toward a task.
    suggestedToId: v.optional(v.id("members")),
    suggestedById: v.optional(v.id("members")),
    suggestedAt: v.optional(v.number()),
    // Nudge bookkeeping so the cron doesn't spam the same task repeatedly.
    lastOverdueNudge: v.optional(v.number()),
    lastStaleNudge: v.optional(v.number()),
  })
    .index("by_family", ["familyId"])
    .index("by_family_done", ["familyId", "done"]),

  pushSubscriptions: defineTable({
    memberId: v.id("members"),
    familyId: v.id("families"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    createdAt: v.number(),
  })
    .index("by_member", ["memberId"])
    .index("by_endpoint", ["endpoint"])
    .index("by_family", ["familyId"]),
});
