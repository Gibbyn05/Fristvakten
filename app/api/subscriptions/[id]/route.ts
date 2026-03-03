import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const UpdateSchema = z.object({
  merchantName: z.string().min(1).optional(),
  productName: z.string().nullable().optional(),
  status: z.enum(["active", "canceled", "unknown"]).optional(),
  monthlyPrice: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly", "unknown"]).optional(),
  trialEndDate: z.string().datetime().nullable().optional(),
  nextChargeDate: z.string().datetime().nullable().optional(),
  cancellationLink: z.string().url().nullable().optional(),
  isUnused: z.boolean().optional(),
});

async function getSubscriptionForUser(id: string, userId: string) {
  return prisma.subscription.findFirst({ where: { id, userId } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscriptionForUser(params.id, session.user.id);
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = UpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = result.data;

  const updated = await prisma.subscription.update({
    where: { id: params.id },
    data: {
      ...(data.merchantName !== undefined && { merchantName: data.merchantName }),
      ...(data.productName !== undefined && { productName: data.productName }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.monthlyPrice !== undefined && { monthlyPrice: data.monthlyPrice }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.billingCycle !== undefined && { billingCycle: data.billingCycle }),
      ...(data.trialEndDate !== undefined && {
        trialEndDate: data.trialEndDate ? new Date(data.trialEndDate) : null,
      }),
      ...(data.nextChargeDate !== undefined && {
        nextChargeDate: data.nextChargeDate ? new Date(data.nextChargeDate) : null,
      }),
      ...(data.cancellationLink !== undefined && { cancellationLink: data.cancellationLink }),
      ...(data.isUnused !== undefined && { isUnused: data.isUnused }),
      // User confirming the subscription boosts confidence
      confidence: 1.0,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await getSubscriptionForUser(params.id, session.user.id);
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.subscription.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
