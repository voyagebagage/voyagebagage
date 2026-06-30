import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for overdue tasks a few times a day.
crons.interval(
  "overdue nudges",
  { hours: 4 },
  internal.nudges.runOverdueNudges,
);

// Tease about stale tasks once a day, late afternoon UTC.
crons.daily(
  "stale nudges",
  { hourUTC: 16, minuteUTC: 0 },
  internal.nudges.runStaleNudges,
);

// Morning summary. 7am in UTC+7 (Bangkok) == 0:00 UTC; adjust to your timezone.
crons.daily(
  "daily summary",
  { hourUTC: 0, minuteUTC: 0 },
  internal.nudges.runDailySummary,
);

export default crons;
