import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

/**
 * Resolve the member behind a session token, or throw. Every authenticated
 * query/mutation funnels through this so a missing/invalid token is a hard stop.
 */
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  token: string,
): Promise<Doc<"members">> {
  const member = await ctx.db
    .query("members")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!member) {
    throw new Error("Not signed in. Join your family again.");
  }
  return member;
}

/** Generate a hard-to-guess session token (no crypto import needed in V8). */
export function newToken(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

export function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Human-friendly due date for notification text, e.g. "Tue, Jul 7, 18:00".
 * Uses DISPLAY_TZ (default Asia/Bangkok); falls back gracefully if the runtime
 * lacks timezone data.
 */
export function formatDue(ms: number): string {
  const timeZone = process.env.DISPLAY_TZ || "Asia/Bangkok";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toUTCString();
  }
}
