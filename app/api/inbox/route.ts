import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = await prisma.inboundEmail.findMany({
    where: { userId: session.user.id },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      from: true,
      subject: true,
      receivedAt: true,
      parseStatus: true,
      parsedJson: true,
      // rawText intentionally excluded from list view
    },
  });

  return NextResponse.json(emails);
}
