// Build a standard .ics calendar event for a task with a due date.
// iOS opens .ics straight into Apple Calendar; Android opens it into Google
// Calendar. The event carries a 30-minute reminder (VALARM) so it also acts as
// a phone reminder. Web apps can't silently write to the native calendar, so
// this is the one-tap "Add to calendar" path.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Format a timestamp as a UTC iCalendar datetime, e.g. 20260707T110000Z.
function toICSDate(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// Escape text per RFC 5545 (commas, semicolons, backslashes, newlines).
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "task"
  );
}

export function todoToICS(todo: {
  _id: string;
  title: string;
  notes?: string;
  dueAt?: number;
}): string {
  const start = todo.dueAt ?? Date.now();
  const end = start + 60 * 60 * 1000; // default 1-hour block
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Todo//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${todo._id}@family-todo`,
    `DTSTAMP:${toICSDate(Date.now())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(todo.title)}`,
    todo.notes ? `DESCRIPTION:${escapeICS(todo.notes)}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICS(todo.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** Trigger the OS "Add to calendar" flow for a task with a due date. */
export function addToCalendar(todo: {
  _id: string;
  title: string;
  notes?: string;
  dueAt?: number;
}): void {
  const ics = todoToICS(todo);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(todo.title)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
