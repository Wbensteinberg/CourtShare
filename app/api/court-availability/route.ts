import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { isMockApiMode } from "@/lib/mockApiMode";
import {
  enforceRateLimit,
  isNextResponse,
  requireFirebaseUser,
} from "@/lib/apiSecurity";

export async function GET(req: NextRequest) {
  if (isMockApiMode()) {
    return NextResponse.json({ slots: [] });
  }

  if (!adminDb) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const auth = await requireFirebaseUser(req, adminAuth);
  if (isNextResponse(auth)) return auth;

  const rateLimitError = await enforceRateLimit(req, "court-availability", auth.uid);
  if (rateLimitError) return rateLimitError;

  const { searchParams } = new URL(req.url);
  const courtId = searchParams.get("courtId");
  const date = searchParams.get("date");

  if (!courtId || !date) {
    return NextResponse.json({ error: "courtId and date are required" }, { status: 400 });
  }
  if (courtId.length > 200 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid courtId or date format" }, { status: 400 });
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
