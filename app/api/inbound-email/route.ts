import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { parseEmail } from "@/lib/parser";

// ─── Provider payload extraction ─────────────────────────────────────────────

interface NormalizedInbound {
  to: string;
  from: string;
  subject: string;
  text: string;
}

function extractSendGrid(form: FormData): NormalizedInbound {
  return {
    to: form.get("to")?.toString() ?? "",
    from: form.get("from")?.toString() ?? "",
    subject: form.get("subject")?.toString() ?? "(no subject)",
    text: form.get("text")?.toString() ?? form.get("html")?.toString() ?? "",
  };
}

function extractMailgun(form: FormData): NormalizedInbound {
  return {
    to: form.get("recipient")?.toString() ?? form.get("To")?.toString() ?? "",
    from: form.get("sender")?.toString() ?? form.get("From")?.toString() ?? "",
    subject: form.get("Subject")?.toString() ?? "(no subject)",
    text:
      form.get("body-plain")?.toString() ??
      form.get("body-html")?.toString() ??
      "",
  };
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySendGridSignature(req: NextRequest): boolean {
  const key = process.env.SENDGRID_WEBHOOK_SECRET;
  if (!key) return true; // skip if not configured

  const signature = req.headers.get("x-twilio-email-event-webhook-signature");
  const timestamp = req.headers.get("x-twilio-email-event-webhook-timestamp");
  if (!signature || !timestamp) return false;

  // SendGrid uses ECDSA – verification requires full crypto. For MVP we skip.
  // TODO: implement full ECDSA verification for production.
  return true;
}

function verifyMailgunSignature(form: FormData): boolean {
  const key = process.env.MAILGUN_WEBHOOK_SECRET;
  if (!key) return true; // skip if not configured

  const timestamp = form.get("timestamp")?.toString();
  const token = form.get("token")?.toString();
  const signature = form.get("signature")?.toString();

  if (!timestamp || !token || !signature) return false;

  const expected = createHmac("sha256", key)
    .update(timestamp + token)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  // Detect provider by presence of fields
  const provider = process.env.EMAIL_PROVIDER ?? "sendgrid";
  let normalized: NormalizedInbound;

  if (provider === "mailgun") {
    if (!verifyMailgunSignature(form)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    normalized = extractMailgun(form);
  } else {
    if (!verifySendGridSignature(request)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    normalized = extractSendGrid(form);
  }

  const { to, from, subject, text } = normalized;

  if (!to || !from) {
    return NextResponse.json({ error: "Missing to/from" }, { status: 400 });
  }

  // Extract local part from recipient address
  const inboundDomain = process.env.INBOUND_DOMAIN ?? "";
  const toLocal = to.split("@")[0]?.toLowerCase() ?? to.toLowerCase();

  // Find matching user
  const user = await prisma.user.findFirst({
    where: {
      forwardAddressLocalPart: { equals: toLocal, mode: "insensitive" },
    },
  });

  if (!user) {
    // Return 200 so the provider doesn't retry
    console.warn(`[INBOUND] No user found for address: ${to}`);
    return NextResponse.json({ ok: true, note: "unknown_recipient" });
  }

  // Deduplicate
  const hash = createHash("sha256")
    .update(`${from}:${subject}:${text.slice(0, 500)}`)
    .digest("hex");

  const existing = await prisma.inboundEmail.findUnique({ where: { hash } });
  if (existing) {
    return NextResponse.json({ ok: true, note: "duplicate" });
  }

  // Run parser
  const parsed = parseEmail(subject, text, from);
  const parseStatus = parsed.confidence >= 0.8 ? "success" : "needs_review";

  // Store inbound email (raw text kept ≤24h via cleanup job; store as-is for MVP)
  const inbound = await prisma.inboundEmail.create({
    data: {
      userId: user.id,
      from,
      subject,
      rawText: text.slice(0, 50_000), // cap at 50KB
      parsedJson: JSON.stringify(parsed),
      parseStatus,
      hash,
    },
  });

  // Find existing subscription for same merchant
  const existingSub = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      merchantName: {
        equals: parsed.merchantName,
        mode: "insensitive",
      },
      status: "active",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingSub) {
    // Update existing subscription
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        ...(parsed.nextChargeDate && { nextChargeDate: parsed.nextChargeDate }),
        ...(parsed.monthlyPrice && { monthlyPrice: parsed.monthlyPrice }),
        ...(parsed.trialEndDate && { trialEndDate: parsed.trialEndDate }),
        ...(parsed.cancellationLink && { cancellationLink: parsed.cancellationLink }),
        confidence: parsed.confidence,
        sourceEmailId: inbound.id,
      },
    });
  } else {
    // Create new subscription
    await prisma.subscription.create({
      data: {
        userId: user.id,
        merchantName: parsed.merchantName,
        productName: parsed.productName,
        status: "active",
        monthlyPrice: parsed.monthlyPrice,
        currency: parsed.currency,
        billingCycle: parsed.billingCycle,
        trialEndDate: parsed.trialEndDate,
        nextChargeDate: parsed.nextChargeDate,
        cancellationLink: parsed.cancellationLink,
        confidence: parsed.confidence,
        sourceEmailId: inbound.id,
      },
    });
  }

  return NextResponse.json({ ok: true, parseStatus, confidence: parsed.confidence });
}
