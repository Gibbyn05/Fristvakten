import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      sourceEmail: {
        select: { id: true, subject: true, receivedAt: true },
      },
    },
  });

  return NextResponse.json(subscriptions);
}
