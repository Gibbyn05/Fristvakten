import {
  parseEmail,
  extractDates,
  extractPrice,
  extractMerchantFromSender,
  extractCancellationLink,
} from "../lib/parser";

// ─── extractMerchantFromSender ────────────────────────────────────────────────

describe("extractMerchantFromSender", () => {
  test("extracts display name from 'Name <email>' format", () => {
    expect(extractMerchantFromSender("TV2 Play <noreply@tv2.no>")).toBe("TV2 Play");
    expect(extractMerchantFromSender("Netflix <info@netflix.com>")).toBe("Netflix");
  });

  test("capitalizes domain name when no display name", () => {
    expect(extractMerchantFromSender("noreply@spotify.com")).toBe("Spotify");
    expect(extractMerchantFromSender("billing@adobe.com")).toBe("Adobe");
  });
});

// ─── extractDates ─────────────────────────────────────────────────────────────

describe("extractDates", () => {
  test("extracts ISO dates", () => {
    const dates = extractDates("First payment on 2025-09-15.");
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(new Date(2025, 8, 15));
  });

  test("extracts Norwegian dot-separated dates", () => {
    const dates = extractDates("Forfaller 15.09.2025.");
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(new Date(2025, 8, 15));
  });

  test("extracts Norwegian month names", () => {
    const dates = extractDates("Første betaling 3 september 2025.");
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(new Date(2025, 8, 3));
  });

  test("extracts English month names", () => {
    const dates = extractDates("Your trial ends March 15, 2025.");
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(new Date(2025, 2, 15));
  });

  test("returns empty array when no dates found", () => {
    expect(extractDates("No dates here at all!")).toHaveLength(0);
  });

  test("deduplicates identical dates", () => {
    const dates = extractDates("2025-09-15 and 2025-09-15 again");
    expect(dates).toHaveLength(1);
  });
});

// ─── extractPrice ─────────────────────────────────────────────────────────────

describe("extractPrice", () => {
  test("detects NOK price with kr suffix", () => {
    const result = extractPrice("Abonnementet koster 179 kr/måned");
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(17900);
    expect(result?.currency).toBe("NOK");
  });

  test("detects NOK price with NOK prefix", () => {
    const result = extractPrice("Pris: NOK 299,-");
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(29900);
  });

  test("detects USD price", () => {
    const result = extractPrice("Price: $9.99/month");
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(999);
    expect(result?.currency).toBe("USD");
  });

  test("detects EUR price", () => {
    const result = extractPrice("Preis: €12,99/Monat");
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(1299);
    expect(result?.currency).toBe("EUR");
  });

  test("returns null when no price found", () => {
    expect(extractPrice("No price information here")).toBeNull();
  });
});

// ─── extractCancellationLink ──────────────────────────────────────────────────

describe("extractCancellationLink", () => {
  test("detects cancel link", () => {
    const text = "To cancel your subscription visit https://example.com/cancel/abc123";
    const link = extractCancellationLink(text);
    expect(link).toContain("cancel");
  });

  test("detects Norwegian avbryt link", () => {
    const text = "Avslutt abonnementet her: https://tv2.no/play/avbryt/123";
    const link = extractCancellationLink(text);
    expect(link).not.toBeNull();
  });

  test("returns null when no cancel link", () => {
    expect(extractCancellationLink("No links here at all")).toBeNull();
  });
});

// ─── parseEmail – full integration ───────────────────────────────────────────

describe("parseEmail", () => {
  test("TV2 Play – 3 months free trial email (Norwegian)", () => {
    const subject = "Velkommen til TV2 Play! 3 måneder gratis";
    const body = `
Hei!

Du har nå aktivert 3 måneder gratis TV2 Play Total.

Etter prøveperioden vil du bli belastet 299 kr/måned.
Første betaling: 15.03.2025

Avslutt abonnementet her: https://tv2.no/play/cancel/abc123

Hilsen TV2`;
    const from = "TV2 Play <noreply@tv2.no>";

    const result = parseEmail(subject, body, from);

    expect(result.merchantName).toBe("TV2 Play");
    expect(result.monthlyPrice).toBe(29900);
    expect(result.currency).toBe("NOK");
    expect(result.billingCycle).toBe("monthly");
    expect(result.trialEndDate).not.toBeNull();
    expect(result.cancellationLink).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.notes).toContain("Trial period detected");
  });

  test("Netflix receipt – no trial, next charge detected", () => {
    const subject = "Your Netflix receipt for March 2025";
    const body = `
Thank you for your payment.

Netflix Standard: $15.49/month
Next charge: March 15, 2025

Manage your account at https://netflix.com/account`;
    const from = "Netflix <info@netflix.com>";

    const result = parseEmail(subject, body, from);

    expect(result.merchantName).toBe("Netflix");
    expect(result.monthlyPrice).toBe(1549);
    expect(result.currency).toBe("USD");
    expect(result.billingCycle).toBe("monthly");
    expect(result.trialEndDate).toBeNull();
  });

  test("Spotify – annual subscription", () => {
    const subject = "Ditt Spotify Premium abonnement er fornyet";
    const body = `
Hei,

Ditt Spotify Premium-abonnement for ett år er fornyet.
Pris: NOK 1188,- per år
Neste fornying: 2026-01-15

Abonnement administreres på https://spotify.com/account`;
    const from = "Spotify <noreply@spotify.com>";

    const result = parseEmail(subject, body, from);

    expect(result.merchantName).toBe("Spotify");
    expect(result.billingCycle).toBe("yearly");
    // yearly price 1188,- normalized to monthly = 1188/12 = 99 -> 9900 cents
    expect(result.monthlyPrice).toBe(9900);
  });

  test("low confidence email – unrelated email", () => {
    const subject = "Hello from your friend";
    const body = "Hey, how are you doing? Let's meet up next week.";
    const from = "friend@example.com";

    const result = parseEmail(subject, body, from);
    expect(result.confidence).toBeLessThan(0.8);
  });

  test("Viaplay – trial expiry with high confidence", () => {
    const subject = "Din prøveperiode hos Viaplay utløper snart";
    const body = `
Din gratis prøveperiode utløper 2025-06-10.
Etter dette belastes du 399 kr/måned med mindre du avslutter.
Avbryt her: https://viaplay.no/avbryt/123

Med vennlig hilsen, Viaplay`;
    const from = "Viaplay <service@viaplay.no>";

    const result = parseEmail(subject, body, from);

    expect(result.merchantName).toBe("Viaplay");
    expect(result.monthlyPrice).toBe(39900);
    expect(result.trialEndDate).not.toBeNull();
    expect(result.cancellationLink).toContain("avbryt");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
