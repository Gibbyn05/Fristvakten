import { isValid } from "date-fns";

export interface ParsedSubscription {
  merchantName: string;
  productName: string | null;
  trialEndDate: Date | null;
  nextChargeDate: Date | null;
  /** Price in cents (øre) */
  monthlyPrice: number | null;
  currency: string;
  billingCycle: "monthly" | "yearly" | "unknown";
  cancellationLink: string | null;
  /** 0..1 */
  confidence: number;
  notes: string[];
}

// ─── Date helpers ────────────────────────────────────────────────────────────

const NO_MONTHS: Record<string, number> = {
  januar: 0,
  februar: 1,
  mars: 2,
  april: 3,
  mai: 4,
  juni: 5,
  juli: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11,
};

const EN_MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function tryDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month, day);
  return isValid(d) && d.getFullYear() === year ? d : null;
}

export function extractDates(text: string): Date[] {
  const seen = new Set<number>();
  const dates: Date[] = [];

  function add(d: Date | null) {
    if (d && !seen.has(d.getTime())) {
      seen.add(d.getTime());
      dates.push(d);
    }
  }

  // ISO 8601: 2024-03-15
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    add(tryDate(+m[1], +m[2] - 1, +m[3]));
  }

  // DD.MM.YYYY or DD/MM/YYYY
  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    add(tryDate(+m[3], +m[2] - 1, +m[1]));
  }

  // 15 mars 2024 (Norwegian)
  const noMonthRe = new RegExp(
    `\\b(\\d{1,2})\\s+(${Object.keys(NO_MONTHS).join("|")})\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(noMonthRe)) {
    const month = NO_MONTHS[m[2].toLowerCase()];
    if (month !== undefined) add(tryDate(+m[3], month, +m[1]));
  }

  // 15 March 2024 (English)
  const enMonthRe = new RegExp(
    `\\b(\\d{1,2})\\s+(${Object.keys(EN_MONTHS).join("|")})\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(enMonthRe)) {
    const month = EN_MONTHS[m[2].toLowerCase()];
    if (month !== undefined) add(tryDate(+m[3], month, +m[1]));
  }

  // March 15, 2024
  const enDayYearRe = new RegExp(
    `\\b(${Object.keys(EN_MONTHS).join("|")})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`,
    "gi"
  );
  for (const m of text.matchAll(enDayYearRe)) {
    const month = EN_MONTHS[m[1].toLowerCase()];
    if (month !== undefined) add(tryDate(+m[3], month, +m[2]));
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

// ─── Price helpers ────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  // Handle "1.299" (Norwegian thousands) vs "12.99" (decimal)
  const cleaned = raw.replace(/\s/g, "");
  if (/^\d{1,3}\.\d{3}$/.test(cleaned)) {
    // Norwegian thousands: 1.299 -> 1299
    return parseInt(cleaned.replace(".", ""), 10) * 100;
  }
  return Math.round(parseFloat(cleaned.replace(",", ".")) * 100);
}

export function extractPrice(
  text: string
): { amount: number; currency: string } | null {
  const patterns: [RegExp, string][] = [
    [/NOK\s*([\d.,]+)/gi, "NOK"],
    [/([\d.,]+)\s*NOK/gi, "NOK"],
    [/([\d.,]+)\s*kr(?:\.|(?=\s|$|\/))/gi, "NOK"],
    [/kr\.?\s*([\d.,]+)/gi, "NOK"],
    [/([\d.,]+)\s*,-/g, "NOK"],
    [/\$\s*([\d.,]+)/g, "USD"],
    [/USD\s*([\d.,]+)/gi, "USD"],
    [/€\s*([\d.,]+)/g, "EUR"],
    [/EUR\s*([\d.,]+)/gi, "EUR"],
  ];

  for (const [re, currency] of patterns) {
    const m = re.exec(text);
    if (m) {
      const amount = parseAmount(m[1]);
      if (amount > 0 && amount < 1_000_000_00) {
        // sanity: < 1M in currency
        return { amount, currency };
      }
    }
  }

  return null;
}

// ─── Other helpers ────────────────────────────────────────────────────────────

export function extractMerchantFromSender(from: string): string {
  const nameMatch = from.match(/^([^<@]+?)\s*</);
  if (nameMatch) return nameMatch[1].trim();

  const domainMatch = from.match(/@([^.]+)\./);
  if (domainMatch) {
    const name = domainMatch[1];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return from.split("@")[0] ?? from;
}

export function extractCancellationLink(text: string): string | null {
  const keywords =
    /cancel|avbryt|avslutt|unsubscribe|opsig|si\s+opp|avslutte/i;
  for (const m of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    if (keywords.test(m[0])) return m[0];
  }
  // Look for "cancel here: <url>" pattern
  const ctaMatch = text.match(
    /(?:avbryt|avslutt|cancel)[^:]*:\s*(https?:\/\/[^\s<>"']+)/i
  );
  return ctaMatch ? ctaMatch[1] : null;
}

function detectBillingCycle(text: string): "monthly" | "yearly" | "unknown" {
  if (/per\s+m[åa]ned|monthly|per\s+month|m[åa]nedlig|\/month|\/m[åa]ned|pr\.?\s*mnd/i.test(text))
    return "monthly";
  if (/per\s+[åa]r|yearly|annual|per\s+year|[åa]rlig|\/year|\/[åa]r/i.test(text))
    return "yearly";
  return "unknown";
}

function hasTrial(text: string): boolean {
  return /gratis|trial|prøveperiode|free\s+for|prøv\s+gratis|m[åa]neder\s+gratis|months?\s+free|free\s+trial|prøveabonnement|prøvetid/i.test(
    text
  );
}

function hasSubscriptionKeywords(text: string): boolean {
  return /abonnement|subscription|receipt|kvittering|faktura|invoice|betaling|payment|fornyes|renews|recurring/i.test(
    text
  );
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseEmail(
  subject: string,
  body: string,
  from: string
): ParsedSubscription {
  const fullText = `${subject}\n${body}`;
  const notes: string[] = [];
  let confidence = 0.3;

  const merchantName = extractMerchantFromSender(from);

  // Product name heuristic from subject
  let productName: string | null = null;
  const prodMatch = subject.match(
    /(?:ditt|your|abonnement på|subscription to|plan|konto)[:\s]+([^,\n–-]{3,50})/i
  );
  if (prodMatch) productName = prodMatch[1].trim();

  // Price
  const priceInfo = extractPrice(fullText);
  let monthlyPrice = priceInfo?.amount ?? null;
  const currency = priceInfo?.currency ?? "NOK";

  if (priceInfo) {
    confidence += 0.2;
    notes.push(`Detected price: ${priceInfo.amount / 100} ${priceInfo.currency}`);
  }

  // Billing cycle
  const billingCycle = detectBillingCycle(fullText);
  if (billingCycle !== "unknown") {
    confidence += 0.1;
    if (billingCycle === "yearly" && monthlyPrice) {
      monthlyPrice = Math.round(monthlyPrice / 12);
      notes.push("Price normalized from yearly to monthly");
    }
  }

  // Trial
  const isTrial = hasTrial(fullText);
  if (isTrial) {
    confidence += 0.05;
    notes.push("Trial period detected");
  }

  // Dates
  const dates = extractDates(fullText);
  let trialEndDate: Date | null = null;
  let nextChargeDate: Date | null = null;

  const now = new Date();
  const futureDates = dates.filter((d) => d > now);

  if (futureDates.length > 0) {
    confidence += 0.15;
    if (isTrial) {
      trialEndDate = futureDates[0];
      nextChargeDate = futureDates[1] ?? futureDates[0];
    } else {
      nextChargeDate = futureDates[0];
    }
  }

  // Cancellation link
  const cancellationLink = extractCancellationLink(fullText);
  if (cancellationLink) {
    confidence += 0.05;
    notes.push("Cancellation link found");
  }

  // Subscription keywords boost
  if (hasSubscriptionKeywords(fullText)) {
    confidence += 0.15;
    notes.push("Subscription keywords detected");
  }

  // Sender domain boost (typical no-reply patterns)
  if (/noreply|no-reply|donotreply|service|support|billing|account/i.test(from)) {
    confidence += 0.05;
  }

  confidence = Math.min(1, parseFloat(confidence.toFixed(2)));

  return {
    merchantName,
    productName,
    trialEndDate,
    nextChargeDate,
    monthlyPrice,
    currency,
    billingCycle,
    cancellationLink,
    confidence,
    notes,
  };
}
