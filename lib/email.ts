import nodemailer from "nodemailer";

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function createTransport() {
  // Use SMTP if configured, else fall back to Ethereal/console in dev
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }

  // Dev mode: print to console
  return nodemailer.createTransport({ jsonTransport: true });
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  const transport = createTransport();
  const from = process.env.EMAIL_FROM ?? "Fristvakt <noreply@fristvakt.no>";

  const info = await transport.sendMail({ from, ...opts });

  if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST) {
    console.log("[EMAIL] Would send:", {
      to: opts.to,
      subject: opts.subject,
    });
    console.log("[EMAIL] Body:", opts.text ?? opts.html.replace(/<[^>]+>/g, ""));
  } else {
    console.log(`[EMAIL] Sent to ${opts.to}: ${info.messageId}`);
  }
}

// ─── Notification templates ───────────────────────────────────────────────────

export function trialExpiryEmail(opts: {
  userEmail: string;
  merchantName: string;
  productName: string | null;
  trialEndDate: Date;
  daysLeft: number;
  cancellationLink: string | null;
  monthlyPrice: number | null;
  currency: string;
}): MailOptions {
  const product = opts.productName
    ? `${opts.merchantName} ${opts.productName}`
    : opts.merchantName;
  const price = opts.monthlyPrice
    ? `${(opts.monthlyPrice / 100).toFixed(0)} ${opts.currency}`
    : "ukjent pris";
  const cancelHtml = opts.cancellationLink
    ? `<p><a href="${opts.cancellationLink}" style="color:#dc2626;font-weight:bold;">Avslutt abonnement her</a></p>`
    : "<p>Logg inn hos leverandøren for å avslutte.</p>";

  const daysText =
    opts.daysLeft === 0
      ? "utløper I DAG"
      : opts.daysLeft === 1
        ? "utløper I MORGEN"
        : `utløper om ${opts.daysLeft} dager`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#15803d">Fristvakt – prøveperiodepåminnelse</h2>
      <p>Din gratis prøveperiode hos <strong>${product}</strong> <strong>${daysText}</strong>.</p>
      <p>Etter prøveperioden belastes du <strong>${price}/måned</strong>.</p>
      ${cancelHtml}
      <hr/>
      <p style="color:#6b7280;font-size:0.85em">
        Denne påminnelsen ble sendt av Fristvakt.
        <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/app/subscriptions">Se alle abonnementer</a>
      </p>
    </div>
  `;

  return {
    to: opts.userEmail,
    subject: `Fristvakt: ${product} – prøveperiode ${daysText}`,
    html,
    text: `Din prøveperiode hos ${product} ${daysText}. Pris: ${price}/md. ${opts.cancellationLink ? `Avslutt: ${opts.cancellationLink}` : ""}`,
  };
}

export function upcomingChargeEmail(opts: {
  userEmail: string;
  merchantName: string;
  productName: string | null;
  nextChargeDate: Date;
  daysLeft: number;
  monthlyPrice: number | null;
  currency: string;
}): MailOptions {
  const product = opts.productName
    ? `${opts.merchantName} ${opts.productName}`
    : opts.merchantName;
  const price = opts.monthlyPrice
    ? `${(opts.monthlyPrice / 100).toFixed(0)} ${opts.currency}`
    : "ukjent pris";
  const dateStr = opts.nextChargeDate.toLocaleDateString("no-NO");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#15803d">Fristvakt – kommende betaling</h2>
      <p><strong>${product}</strong> belaster deg <strong>${price}</strong> om ${opts.daysLeft} dager (${dateStr}).</p>
      <p>
        <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/app/subscriptions">
          Se og administrer dine abonnementer
        </a>
      </p>
      <hr/>
      <p style="color:#6b7280;font-size:0.85em">Sendt av Fristvakt.</p>
    </div>
  `;

  return {
    to: opts.userEmail,
    subject: `Fristvakt: Betaling fra ${product} om ${opts.daysLeft} dager`,
    html,
    text: `${product} belaster deg ${price} om ${opts.daysLeft} dager (${dateStr}). Se: ${process.env.NEXTAUTH_URL}/app/subscriptions`,
  };
}
