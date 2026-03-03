import { NextRequest, NextResponse } from "next/server";
import { runNotificationJob } from "@/lib/notifications";

/**
 * GET /api/cron/notifications
 *
 * Trigger the daily notification job.
 * Protect with CRON_SECRET to prevent unauthorized calls.
 *
 * Setup in vercel.json or call from a server cron (e.g. systemd timer):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/notifications
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const result = await runNotificationJob();
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CRON] Notification job failed:", err);
    return NextResponse.json(
      { error: "Job failed", detail: String(err) },
      { status: 500 }
    );
  }
}
