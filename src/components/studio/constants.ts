import type { Settings, Status } from "./types";

export const defaultSettings: Settings = {
  workingDays: 5,
  reminderTime: "09:00",
  timeZone: "Africa/Lagos",
  attentionDaysBefore: 3,
  dueSoonDaysBefore: [3, 2],
  overdueGraceDays: 0,
  overdueRepeatDays: 1,
  stalledRemindersEnabled: false,
  stalledAfterDays: 2,
  stalledRepeatDays: 2,
};

export const legacyDemoProductIds = new Set(["p1", "p2", "p3", "p4"]);

export const legacyDemoOrderIds = new Set(["O-1048", "O-1047", "O-1043", "O-1039"]);

export const legacyDemoExpenseIds = new Set(["e1"]);

export const statusLabel: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  delivered: "Delivered",
};

export const statusStyle: Record<Status, string> = {
  not_started: "status-not-started",
  in_progress: "status-in-progress",
  ready: "status-complete",
  delivered: "status-complete",
};

export const nextActionLabel: Partial<Record<Status, string>> = {
  not_started: "Start order",
  in_progress: "Mark ready",
  ready: "Mark delivered",
};
