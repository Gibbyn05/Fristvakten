import { prisma } from "./db";
import { sendEmail, trialExpiryEmail, upcomingChargeEmail } from "./email";
import { differenceInDays, startOfDay } from "date-fns";

type NotificationType = "TRIAL_7D" | "TRIAL_2D" | "TRIAL_0D" | "CHARGE_3D";

const TRIAL_THRESHOLDS: { days: number; type: NotificationType }[] = [
  { days: 7, type: "TRIAL_7D" },
  { days: 2, type: "TRIAL_2D" },
  { days: 0, type: "TRIAL_0D" },
];

const CHARGE_THRESHOLDS: { days: number; type: NotificationType }[] = [
  { days: 3, type: "CHARGE_3D" },
];

async function hasNotification(
  subscriptionId: string,
  type: NotificationType,
  windowStart: Date
): Promise<boolean> {
  const existing = await prisma.notificationLog.findFirst({
    where: {
      subscriptionId,
      type,
      sentAt: { gte: windowStart },
    },
  });
  return !!existing;
}

async function logNotification(
  userId: string,
  subscriptionId: string,
  type: NotificationType
): Promise<void> {
  await prisma.notificationLog.create({
    data: { userId, subscriptionId, type },
  });
}

export async function runNotificationJob(): Promise<{
  sent: number;
  errors: string[];
}> {
  const today = startOfDay(new Date());
  const errors: string[] = [];
  let sent = 0;

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      OR: [
        { trialEndDate: { not: null } },
        { nextChargeDate: { not: null } },
      ],
    },
    include: {
      user: true,
    },
  });

  for (const sub of subscriptions) {
    // ── Trial expiry notifications ──────────────────────────────────────────
    if (sub.trialEndDate) {
      const daysLeft = differenceInDays(startOfDay(sub.trialEndDate), today);

      for (const threshold of TRIAL_THRESHOLDS) {
        if (daysLeft !== threshold.days) continue;

        // Check idempotency: one notification per type per subscription per day
        const alreadySent = await hasNotification(sub.id, threshold.type, today);
        if (alreadySent) continue;

        try {
          const mail = trialExpiryEmail({
            userEmail: sub.user.email,
            merchantName: sub.merchantName,
            productName: sub.productName,
            trialEndDate: sub.trialEndDate,
            daysLeft,
            cancellationLink: sub.cancellationLink,
            monthlyPrice: sub.monthlyPrice,
            currency: sub.currency,
          });

          await sendEmail(mail);
          await logNotification(sub.userId, sub.id, threshold.type);
          sent++;
        } catch (err) {
          const msg = `Trial notification failed for ${sub.id}: ${err}`;
          console.error(msg);
          errors.push(msg);
        }
      }
    }

    // ── Upcoming charge notifications ────────────────────────────────────────
    if (sub.nextChargeDate && !sub.trialEndDate) {
      const daysLeft = differenceInDays(startOfDay(sub.nextChargeDate), today);

      for (const threshold of CHARGE_THRESHOLDS) {
        if (daysLeft !== threshold.days) continue;

        const alreadySent = await hasNotification(sub.id, threshold.type, today);
        if (alreadySent) continue;

        try {
          const mail = upcomingChargeEmail({
            userEmail: sub.user.email,
            merchantName: sub.merchantName,
            productName: sub.productName,
            nextChargeDate: sub.nextChargeDate,
            daysLeft,
            monthlyPrice: sub.monthlyPrice,
            currency: sub.currency,
          });

          await sendEmail(mail);
          await logNotification(sub.userId, sub.id, threshold.type);
          sent++;
        } catch (err) {
          const msg = `Charge notification failed for ${sub.id}: ${err}`;
          console.error(msg);
          errors.push(msg);
        }
      }
    }
  }

  return { sent, errors };
}
