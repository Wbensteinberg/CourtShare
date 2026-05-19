import {
  FieldValue,
  Timestamp,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";

type LockInput = {
  courtId: string;
  date: string;
  time: string;
  durationMinutes: number;
  courtNumber?: number;
};

const LOCK_COLLECTION = "bookingSlotLocks";
const SLOT_GRANULARITY_MINUTES = 30;

function parseTimeToMinutes(time: string) {
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  const match = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function safeIdPart(value: string | number) {
  return String(value).replace(/[^A-Za-z0-9_-]/g, "_");
}

export function getBookingSlotLockIds(input: LockInput) {
  const start = parseTimeToMinutes(input.time);
  if (start == null) {
    throw new Error("Invalid booking time");
  }

  const durationMinutes = Math.max(1, Math.ceil(input.durationMinutes));
  const end = start + durationMinutes;
  const firstSlot =
    Math.floor(start / SLOT_GRANULARITY_MINUTES) * SLOT_GRANULARITY_MINUTES;
  const lockIds: string[] = [];

  for (
    let minute = firstSlot;
    minute < end;
    minute += SLOT_GRANULARITY_MINUTES
  ) {
    lockIds.push(
      [
        safeIdPart(input.courtId),
        safeIdPart(input.date),
        safeIdPart(input.courtNumber || 1),
        minute,
      ].join("_")
    );
  }

  return lockIds;
}

function timestampToMillis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return null;
}

export function isReusableExpiredLock(data: FirebaseFirestore.DocumentData) {
  if (data.status !== "pending") return false;
  const expiresAt = timestampToMillis(data.expiresAt);
  return expiresAt != null && expiresAt <= Date.now();
}

export async function assertAndWriteBookingSlotLocks(params: {
  db: Firestore;
  transaction: Transaction;
  bookingId: string;
  sessionId: string;
  input: LockInput;
  expiresAt: Date;
}) {
  const lockIds = getBookingSlotLockIds(params.input);
  const lockRefs = lockIds.map((lockId) =>
    params.db.collection(LOCK_COLLECTION).doc(lockId)
  );
  const lockDocs = await Promise.all(
    lockRefs.map((lockRef) => params.transaction.get(lockRef))
  );

  for (const lockDoc of lockDocs) {
    if (!lockDoc.exists) continue;
    const data = lockDoc.data() || {};
    if (data.sessionId === params.sessionId || isReusableExpiredLock(data)) {
      continue;
    }
    throw new Error("Time slot was already booked");
  }

  lockRefs.forEach((lockRef) => {
    params.transaction.set(lockRef, {
      ...params.input,
      bookingId: params.bookingId,
      sessionId: params.sessionId,
      status: "pending",
      expiresAt: params.expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return lockIds;
}

export async function markBookingSlotLocksConfirmed(
  db: Firestore,
  bookingId: string,
  bookingData: FirebaseFirestore.DocumentData
) {
  let lockIds: unknown[];
  try {
    lockIds = Array.isArray(bookingData.slotLockIds)
      ? bookingData.slotLockIds
      : getBookingSlotLockIds({
          courtId: String(bookingData.courtId || ""),
          date: String(bookingData.date || ""),
          time: String(bookingData.time || ""),
          durationMinutes:
            typeof bookingData.durationMinutes === "number"
              ? bookingData.durationMinutes
              : Math.round((Number(bookingData.duration) || 1) * 60),
          courtNumber: Number(bookingData.courtNumber) || 1,
        });
  } catch {
    return;
  }

  const batch = db.batch();
  lockIds.forEach((lockId) => {
    batch.set(
      db.collection(LOCK_COLLECTION).doc(String(lockId)),
      {
        bookingId,
        status: "confirmed",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  try {
    await batch.commit();
  } catch (err) {
    console.warn("[BOOKING-SLOT-LOCKS] Failed to confirm locks:", err);
  }
}

export async function releaseBookingSlotLocks(
  db: Firestore,
  bookingData: FirebaseFirestore.DocumentData
) {
  let lockIds: unknown[];
  try {
    lockIds = Array.isArray(bookingData.slotLockIds)
      ? bookingData.slotLockIds
      : getBookingSlotLockIds({
          courtId: String(bookingData.courtId || ""),
          date: String(bookingData.date || ""),
          time: String(bookingData.time || ""),
          durationMinutes:
            typeof bookingData.durationMinutes === "number"
              ? bookingData.durationMinutes
              : Math.round((Number(bookingData.duration) || 1) * 60),
          courtNumber: Number(bookingData.courtNumber) || 1,
        });
  } catch {
    return;
  }

  const batch = db.batch();
  lockIds.forEach((lockId) =>
    batch.delete(db.collection(LOCK_COLLECTION).doc(String(lockId)))
  );
  try {
    await batch.commit();
  } catch (err) {
    console.warn("[BOOKING-SLOT-LOCKS] Failed to release locks:", err);
  }
}
