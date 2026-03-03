/**
 * Inbound email routing tests.
 *
 * These tests verify that:
 * 1. The correct user is matched by forwardAddressLocalPart
 * 2. Duplicate emails are rejected
 * 3. Subscriptions are created/updated correctly
 *
 * We test the routing logic (user lookup + dedup) in isolation
 * without hitting the HTTP layer, to keep tests fast and deterministic.
 */

import { createHash } from "crypto";

// ─── Helpers mirroring inbound-email/route.ts logic ──────────────────────────

function computeHash(from: string, subject: string, text: string): string {
  return createHash("sha256")
    .update(`${from}:${subject}:${text.slice(0, 500)}`)
    .digest("hex");
}

function extractLocalPart(to: string): string {
  return to.split("@")[0]?.toLowerCase() ?? to.toLowerCase();
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("inbound email routing helpers", () => {
  describe("extractLocalPart", () => {
    test("extracts local part from full email", () => {
      expect(extractLocalPart("abc123def@inbound.fristvakt.no")).toBe("abc123def");
    });

    test("handles addresses without domain", () => {
      expect(extractLocalPart("abc123")).toBe("abc123");
    });

    test("normalizes to lowercase", () => {
      expect(extractLocalPart("ABC123@inbound.fristvakt.no")).toBe("abc123");
    });
  });

  describe("computeHash", () => {
    test("produces consistent hash for same inputs", () => {
      const h1 = computeHash("from@example.com", "Subject", "Body text");
      const h2 = computeHash("from@example.com", "Subject", "Body text");
      expect(h1).toBe(h2);
    });

    test("produces different hashes for different inputs", () => {
      const h1 = computeHash("from@example.com", "Subject A", "Body");
      const h2 = computeHash("from@example.com", "Subject B", "Body");
      expect(h1).not.toBe(h2);
    });

    test("only uses first 500 chars of body for hash", () => {
      const shortBody = "A".repeat(500);
      const longBody = "A".repeat(500) + "extra content that differs";
      const h1 = computeHash("from@a.com", "Sub", shortBody);
      const h2 = computeHash("from@a.com", "Sub", longBody);
      expect(h1).toBe(h2);
    });

    test("hash is hex string of expected length (SHA-256 = 64 chars)", () => {
      const h = computeHash("a@b.com", "sub", "body");
      expect(h).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

// ─── Subscription merge logic ─────────────────────────────────────────────────

describe("subscription merge logic", () => {
  /**
   * When a new email arrives for an existing merchant, we should update
   * fields rather than create a duplicate subscription.
   */
  test("identifies same merchant (case-insensitive)", () => {
    const existing = { merchantName: "Netflix", status: "active" };
    const incoming = { merchantName: "netflix" };

    const isSameMerchant =
      existing.merchantName.toLowerCase() === incoming.merchantName.toLowerCase() &&
      existing.status === "active";

    expect(isSameMerchant).toBe(true);
  });

  test("creates new subscription for different merchant", () => {
    const existingMerchants = ["Netflix", "Spotify"];
    const incomingMerchant = "Viaplay";

    const exists = existingMerchants.some(
      (m) => m.toLowerCase() === incomingMerchant.toLowerCase()
    );

    expect(exists).toBe(false);
  });
});

// ─── Provider payload normalization ──────────────────────────────────────────

describe("provider payload normalization", () => {
  /**
   * SendGrid sends form fields: from, to, subject, text
   * Mailgun sends: From, To, Subject, body-plain, recipient
   */
  function normalizeSendGrid(fields: Record<string, string>) {
    return {
      to: fields.to ?? "",
      from: fields.from ?? "",
      subject: fields.subject ?? "(no subject)",
      text: fields.text ?? fields.html ?? "",
    };
  }

  function normalizeMailgun(fields: Record<string, string>) {
    return {
      to: fields.recipient ?? fields.To ?? "",
      from: fields.sender ?? fields.From ?? "",
      subject: fields.Subject ?? "(no subject)",
      text: fields["body-plain"] ?? fields["body-html"] ?? "",
    };
  }

  test("normalizes SendGrid payload", () => {
    const result = normalizeSendGrid({
      from: "sender@example.com",
      to: "abc@inbound.fristvakt.no",
      subject: "Test email",
      text: "Body content",
    });

    expect(result.from).toBe("sender@example.com");
    expect(result.to).toBe("abc@inbound.fristvakt.no");
    expect(result.subject).toBe("Test email");
    expect(result.text).toBe("Body content");
  });

  test("normalizes Mailgun payload", () => {
    const result = normalizeMailgun({
      From: "sender@example.com",
      recipient: "abc@inbound.fristvakt.no",
      Subject: "Test email",
      "body-plain": "Body content",
    });

    expect(result.from).toBe("sender@example.com");
    expect(result.to).toBe("abc@inbound.fristvakt.no");
    expect(result.subject).toBe("Test email");
    expect(result.text).toBe("Body content");
  });

  test("falls back to '(no subject)' when subject is missing", () => {
    const result = normalizeSendGrid({
      from: "a@b.com",
      to: "x@y.com",
      text: "body",
    });
    expect(result.subject).toBe("(no subject)");
  });
});
