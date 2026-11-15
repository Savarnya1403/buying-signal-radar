import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "buying-signal-radar",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
