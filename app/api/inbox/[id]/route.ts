import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = await prisma.inboundEmail.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Clear raw text first (privacy), then delete record
  await prisma.inboundEmail.update({
    where: { id: params.id },
    data: { rawText: null },
  });

  await prisma.inboundEmail.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
