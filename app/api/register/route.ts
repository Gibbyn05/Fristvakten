import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = RegisterSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password } = result.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);
  const forwardAddressLocalPart = randomBytes(8).toString("hex");

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashed,
      forwardAddressLocalPart,
    },
    select: { id: true, email: true, forwardAddressLocalPart: true },
  });

  return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
}
