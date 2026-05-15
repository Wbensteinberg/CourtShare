import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { isMockApiMode } from "@/lib/mockApiMode";

export async function GET(req: NextRequest) {
  if (isMockApiMode()) {
    return NextResponse.json({ slots: [] });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courtId = searchParams.get("courtId");
  const date = searchParams.get("date");

  if (!courtId || !date) {
    return NextResponse.json({ error: "courtId and date are required" }, { status: 400 });
  }

  const snap = await adminDb
    .collection("bookings")
    .where("courtId", "==", courtId)
    .where("date", "==", date)
    .get();

  const slots = snap.docs.map((d) => {
    const b = d.data();
    return {
      date: b.date,
      time: b.time,
      status: b.status,
      courtNumber: b.courtNumber ?? null,
      duration: b.duration ?? null,
      durationMinutes: b.durationMinutes ?? null,
      createdAt: b.createdAt ?? null,
      expiresAt: b.expiresAt ?? null,
    };
  });

  return NextResponse.json({ slots });
}
