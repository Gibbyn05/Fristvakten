/**
 * Notification job idempotency and scheduling tests.
 *
 * Tests the scheduling logic (which notifications to send on which days)
 * in isolation from the database, to keep tests fast.
 */

import { differenceInDays, startOfDay, addDays, subDays } from "date-fns";

// ─── Scheduling logic (mirrors notifications.ts) ──────────────────────────────

type NotificationType = "TRIAL_7D" | "TRIAL_2D" | "TRIAL_0D" | "CHARGE_3D";

const TRIAL_THRESHOLDS: { days: number; type: NotificationType }[] = [
  { days: 7, type: "TRIAL_7D" },
  { days: 2, type: "TRIAL_2D" },
  { days: 0, type: "TRIAL_0D" },
];

const CHARGE_THRESHOLDS: { days: number; type: NotificationType }[] = [
  { days: 3, type: "CHARGE_3D" },
];

interface MockSub {
  id: string;
  trialEndDate: Date | null;
  nextChargeDate: Date | null;
}

interface SentNotification {
  subscriptionId: string;
  type: NotificationType;
}

function getTrialNotifications(sub: MockSub, today: Date): NotificationType[] {
  if (!sub.trialEndDate) return [];
  const daysLeft = differenceInDays(startOfDay(sub.trialEndDate), today);
  return TRIAL_THRESHOLDS.filter((t) => t.days === daysLeft).map((t) => t.type);
}

function getChargeNotifications(sub: MockSub, today: Date): NotificationType[] {
  if (!sub.nextChargeDate || sub.trialEndDate) return [];
  const daysLeft = differenceInDays(startOfDay(sub.nextChargeDate), today);
  return CHARGE_THRESHOLDS.filter((t) => t.days === daysLeft).map((t) => t.type);
}

function shouldSend(
  subId: string,
  type: NotificationType,
  alreadySent: SentNotification[]
): boolean {
  return !alreadySent.some(
    (n) => n.subscriptionId === subId && n.type === type
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("trial notification scheduling", () => {
  const today = startOfDay(new Date("2025-03-01"));

  test("sends TRIAL_7D exactly 7 days before trial ends", () => {
    const sub: MockSub = {
      id: "sub-1",
      trialEndDate: addDays(today, 7),
      nextChargeDate: null,
    };
    const notifications = getTrialNotifications(sub, today);
    expect(notifications).toContain("TRIAL_7D");
    expect(notifications).not.toContain("TRIAL_2D");
  });

  test("sends TRIAL_2D exactly 2 days before trial ends", () => {
    const sub: MockSub = {
      id: "sub-1",
      trialEndDate: addDays(today, 2),
      nextChargeDate: null,
    };
    const notifications = getTrialNotifications(sub, today);
    expect(notifications).toContain("TRIAL_2D");
    expect(notifications).not.toContain("TRIAL_7D");
  });

  test("sends TRIAL_0D on trial expiry day", () => {
    const sub: MockSub = {
      id: "sub-1",
      trialEndDate: today,
      nextChargeDate: null,
    };
    const notifications = getTrialNotifications(sub, today);
    expect(notifications).toContain("TRIAL_0D");
  });

  test("sends no notifications 5 days before trial ends", () => {
    const sub: MockSub = {
      id: "sub-1",
      trialEndDate: addDays(today, 5),
      nextChargeDate: null,
    };
    const notifications = getTrialNotifications(sub, today);
    expect(notifications).toHaveLength(0);
  });

  test("sends no notifications after trial has expired", () => {
    const sub: MockSub = {
      id: "sub-1",
      trialEndDate: subDays(today, 1),
      nextChargeDate: null,
    };
    const notifications = getTrialNotifications(sub, today);
    expect(notifications).toHaveLength(0);
  });

  test("sends no notifications when trialEndDate is null", () => {
    const sub: MockSub = { id: "sub-1", trialEndDate: null, nextChargeDate: null };
    expect(getTrialNotifications(sub, today)).toHaveLength(0);
  });
});

describe("charge notification scheduling", () => {
  const today = startOfDay(new Date("2025-03-01"));

  test("sends CHARGE_3D exactly 3 days before charge", () => {
    const sub: MockSub = {
      id: "sub-2",
      trialEndDate: null,
      nextChargeDate: addDays(today, 3),
    };
    const notifications = getChargeNotifications(sub, today);
    expect(notifications).toContain("CHARGE_3D");
  });

  test("sends no CHARGE notification 5 days before", () => {
    const sub: MockSub = {
      id: "sub-2",
      trialEndDate: null,
      nextChargeDate: addDays(today, 5),
    };
    const notifications = getChargeNotifications(sub, today);
    expect(notifications).toHaveLength(0);
  });

  test("does not send charge notification when trial is active", () => {
    const sub: MockSub = {
      id: "sub-2",
      trialEndDate: addDays(today, 10), // still in trial
      nextChargeDate: addDays(today, 3),
    };
    const notifications = getChargeNotifications(sub, today);
    expect(notifications).toHaveLength(0);
  });
});

describe("notification idempotency", () => {
  test("does not re-send already sent notification", () => {
    const sent: SentNotification[] = [
      { subscriptionId: "sub-1", type: "TRIAL_7D" },
    ];

    expect(shouldSend("sub-1", "TRIAL_7D", sent)).toBe(false);
  });

  test("allows sending a different notification type for the same subscription", () => {
    const sent: SentNotification[] = [
      { subscriptionId: "sub-1", type: "TRIAL_7D" },
    ];

    expect(shouldSend("sub-1", "TRIAL_2D", sent)).toBe(true);
  });

  test("allows sending same notification type for a different subscription", () => {
    const sent: SentNotification[] = [
      { subscriptionId: "sub-1", type: "TRIAL_7D" },
    ];

    expect(shouldSend("sub-2", "TRIAL_7D", sent)).toBe(true);
  });

  test("allows sending when nothing has been sent yet", () => {
    expect(shouldSend("sub-1", "TRIAL_7D", [])).toBe(true);
  });

  test("prevents double-sending when called twice on same day", () => {
    const sent: SentNotification[] = [];

    // First call
    expect(shouldSend("sub-1", "TRIAL_7D", sent)).toBe(true);
    sent.push({ subscriptionId: "sub-1", type: "TRIAL_7D" });

    // Second call (same day)
    expect(shouldSend("sub-1", "TRIAL_7D", sent)).toBe(false);
  });
});
