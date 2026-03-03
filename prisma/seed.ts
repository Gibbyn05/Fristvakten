import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const password = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      password,
      forwardAddressLocalPart: "demo-abc123",
    },
  });

  console.log(`Created user: ${user.email}`);

  // Sample subscriptions
  const subs = [
    {
      userId: user.id,
      merchantName: "Netflix",
      productName: "Standard",
      status: "active",
      monthlyPrice: 17900,
      currency: "NOK",
      billingCycle: "monthly",
      nextChargeDate: addDays(new Date(), 5),
      confidence: 0.95,
    },
    {
      userId: user.id,
      merchantName: "TV2 Play",
      productName: "Total",
      status: "active",
      monthlyPrice: 29900,
      currency: "NOK",
      billingCycle: "monthly",
      trialEndDate: addDays(new Date(), 6),
      nextChargeDate: addDays(new Date(), 6),
      confidence: 0.9,
    },
    {
      userId: user.id,
      merchantName: "Spotify",
      productName: "Premium",
      status: "active",
      monthlyPrice: 12900,
      currency: "NOK",
      billingCycle: "monthly",
      nextChargeDate: addDays(new Date(), 12),
      confidence: 0.98,
    },
    {
      userId: user.id,
      merchantName: "Adobe",
      productName: "Creative Cloud",
      status: "active",
      monthlyPrice: 69900,
      currency: "NOK",
      billingCycle: "yearly",
      nextChargeDate: addDays(new Date(), 45),
      confidence: 0.85,
      isUnused: true,
    },
    {
      userId: user.id,
      merchantName: "Viaplay",
      productName: "Sport",
      status: "active",
      monthlyPrice: 39900,
      currency: "NOK",
      billingCycle: "monthly",
      trialEndDate: addDays(new Date(), 1),
      nextChargeDate: addDays(new Date(), 1),
      confidence: 0.75,
    },
  ];

  for (const sub of subs) {
    await prisma.subscription.create({ data: sub });
  }

  console.log(`Created ${subs.length} sample subscriptions`);

  // Sample inbound email
  const email = await prisma.inboundEmail.create({
    data: {
      userId: user.id,
      from: "noreply@tv2.no",
      subject: "Velkommen til TV2 Play! 3 måneder gratis",
      rawText: `Hei!

Du har nå aktivert 3 måneder gratis TV2 Play Total.

Etter prøveperioden vil du bli belastet 299 kr/måned.
Første betaling: ${addDays(new Date(), 90).toLocaleDateString("no-NO")}

Avslutt abonnementet her: https://tv2.no/play/cancel/abc123

Hilsen TV2`,
      parseStatus: "success",
      parsedJson: JSON.stringify({
        merchantName: "TV2 Play",
        productName: "Total",
        trialEndDate: addDays(new Date(), 90).toISOString(),
        nextChargeDate: addDays(new Date(), 90).toISOString(),
        monthlyPrice: 29900,
        currency: "NOK",
        billingCycle: "monthly",
        cancellationLink: "https://tv2.no/play/cancel/abc123",
        confidence: 0.9,
        notes: ["3 months free trial detected", "Price: 299 NOK"],
      }),
      hash: "seed-tv2-email-hash-001",
    },
  });

  console.log(`Created sample inbound email: ${email.id}`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
