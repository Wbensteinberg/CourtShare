import { NextRequest, NextResponse } from "next/server";
import {
  isActionablePendingBooking,
  isBookingReviewable,
  isPendingBookingExpired,
} from "@/lib/bookingDates";
import { calculateBookingPriceBreakdown } from "@/lib/pricing";
import { tryGetMockApiUserId } from "@/lib/mockApiAuth";
import {
  createMockApiSeedData,
  type MockApiBookingRow,
  type MockApiCourtRow,
  type MockApiData,
  type MockApiReviewRow,
} from "@/lib/mockApiSeed";

const makeMockId = () =>
  `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

/** Explicit JSON body (avoids empty-body edge cases vs NextResponse.json in some environments). */
const mockJson = (data: unknown, init?: ResponseInit): NextResponse =>
  new NextResponse(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

type PendingCheckout = {
  userId: string;
  courtId: string;
  date: string;
  time: string;
  durationMinutes: number;
  courtNumber: number;
  guestCount: number;
  initialMessage: string;
};

type ServerState = {
  data: MockApiData;
  pendingCheckouts: Map<string, PendingCheckout>;
};

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

let serverState: ServerState | null = null;

const getState = (): ServerState => {
  if (!serverState) {
    serverState = {
      data: createMockApiSeedData(),
      pendingCheckouts: new Map(),
    };
  }
  return serverState;
};

/** Reset in-memory API mock (e.g. between Jest tests). */
export const resetMockApiServerState = () => {
  serverState = {
    data: deepClone(createMockApiSeedData()),
    pendingCheckouts: new Map(),
  };
};

const getPublicProfilePayload = (userId: string, data: MockApiData) => {
  const u = data.users[userId];
  if (!u) return null;

  const confirmedBookingsCount = data.bookings.filter(
    (b) => b.userId === userId && b.status === "confirmed"
  ).length;
  const listingsCount = data.courts.filter((c) => c.ownerId === userId).length;

  return {
    profile: {
      uid: userId,
      displayName: u.displayName?.trim() || "CourtShare user",
      bio: typeof u.bio === "string" ? u.bio : "",
      profileImageUrl: u.profileImageUrl || "",
      isOwner: Boolean(u.isOwner),
      playerRating: typeof u.playerRating === "number" ? u.playerRating : null,
      playerReviewCount: u.playerReviewCount ?? 0,
      ownerRating: typeof u.ownerRating === "number" ? u.ownerRating : null,
      ownerReviewCount: u.ownerReviewCount ?? 0,
      memberSince: u.createdAt ?? null,
      confirmedBookingsCount,
      listingsCount,
    },
  };
};

const serializeReviewPublic = (r: MockApiReviewRow, data: MockApiData) => {
  const reviewer = data.users[r.reviewerId || r.playerId];
  return {
    id: r.id,
    bookingId: r.bookingId,
    courtId: r.courtId,
    reviewerId: r.reviewerId,
    playerId: r.playerId,
    reviewerRole: r.reviewerRole,
    targetType: r.targetType,
    rating: r.rating,
    comment: r.comment || "",
    createdAt: r.createdAt,
    reviewerName: reviewer?.displayName?.trim() || "CourtShare player",
    reviewerProfileImageUrl: reviewer?.profileImageUrl || "",
  };
};

const getUpdatedAverage = (
  currentRating: unknown,
  currentCount: unknown,
  newRating: number
) => {
  const rating = typeof currentRating === "number" ? currentRating : 0;
  const count = typeof currentCount === "number" ? currentCount : 0;
  const nextCount = count + 1;
  const nextRating = (rating * count + newRating) / nextCount;
  return {
    rating: Math.round(nextRating * 10) / 10,
    count: nextCount,
  };
};

const getCourt = (data: MockApiData, courtId: string): MockApiCourtRow | null =>
  data.courts.find((c) => c.id === courtId) || null;

const getBooking = (data: MockApiData, bookingId: string): MockApiBookingRow | null =>
  data.bookings.find((b) => b.id === bookingId) || null;

const requestOrigin = (req: NextRequest) => {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
};

const convertTo24Hour = (time12: string): string => {
  if (/^\d{2}:\d{2}$/.test(time12)) return time12;
  const [timePart, period] = time12.split(" ");
  if (!timePart || !period) return time12;
  const [hours, minutes] = timePart.split(":").map(Number);
  let hours24 = hours;
  if (period === "PM" && hours !== 12) hours24 = hours + 12;
  else if (period === "AM" && hours === 12) hours24 = 0;
  return `${hours24.toString().padStart(2, "0")}:${(minutes || 0).toString().padStart(2, "0")}`;
};

const timeRangesOverlap = (
  start1: string,
  duration1Hours: number,
  start2: string,
  duration2Hours: number
): boolean => {
  const s1 = convertTo24Hour(start1);
  const s2 = convertTo24Hour(start2);
  const [h1] = s1.split(":").map(Number);
  const [h2] = s2.split(":").map(Number);
  const e1 = h1 + duration1Hours;
  const e2 = h2 + duration2Hours;
  return h1 < e2 && e1 > h2;
};

export async function mockPublicProfileGET(userId: string): Promise<NextResponse> {
  const { data } = getState();
  const payload = getPublicProfilePayload(userId, data);
  if (!payload) {
    return mockJson({ error: "Profile not found" }, { status: 404 });
  }
  return mockJson(payload);
}

export async function mockReviewsGET(req: NextRequest): Promise<NextResponse> {
  const { data } = getState();
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get("targetUserId")?.trim();
  const courtId = url.searchParams.get("courtId")?.trim();

  if (targetUserId || courtId) {
    const list = data.reviews.filter((r) => {
      if (targetUserId) return r.revieweeId === targetUserId;
      return r.courtId === courtId;
    });
    const filtered = courtId
      ? list.filter((r) => r.targetType === "court_owner")
      : list;
    const reviews = filtered
      .map((review) => serializeReviewPublic(review, data))
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    return mockJson({ reviews });
  }

  const authHeader = req.headers.get("authorization");
  const reviewerId = tryGetMockApiUserId(authHeader);
  if (!reviewerId) {
    return mockJson(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const bookingIds = new Set(
    (url.searchParams.get("bookingIds") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );

  const reviews = data.reviews
    .filter((r) => r.reviewerId === reviewerId)
    .filter((r) => (bookingIds.size > 0 ? bookingIds.has(r.bookingId) : true))
    .map((r) => ({
      id: r.id,
      bookingId: r.bookingId,
      reviewerRole: r.reviewerRole,
      rating: r.rating,
    }));

  return mockJson({ reviews });
}

export async function mockReviewsPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const reviewerId = tryGetMockApiUserId(authHeader);
  if (!reviewerId) {
    return mockJson(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const { data } = getState();
  let body: { bookingId?: string; rating?: number; comment?: string };
  try {
    body = await req.json();
  } catch {
    return mockJson({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bookingId = body.bookingId;
  const normalizedRating = Number(body.rating);
  const normalizedComment =
    typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : "";

  if (!bookingId || !Number.isInteger(normalizedRating)) {
    return mockJson(
      { error: "Booking ID and whole-star rating are required" },
      { status: 400 }
    );
  }
  if (normalizedRating < 1 || normalizedRating > 5) {
    return mockJson(
      { error: "Rating must be between 1 and 5 stars" },
      { status: 400 }
    );
  }

  const booking = getBooking(data, bookingId);
  if (!booking) {
    return mockJson({ error: "Booking not found" }, { status: 404 });
  }

  const court = getCourt(data, booking.courtId);
  if (!court) {
    return mockJson(
      { error: "Court for this booking was not found" },
      { status: 404 }
    );
  }

  const reviewerRole =
    reviewerId === booking.userId
      ? "player"
      : reviewerId === court.ownerId
        ? "owner"
        : null;

  if (!reviewerRole) {
    return mockJson(
      { error: "Only booking participants can review this booking" },
      { status: 403 }
    );
  }

  if (!isBookingReviewable(booking)) {
    return mockJson(
      {
        error:
          "Reviews are only available for a short window after the scheduled booking ends",
      },
      { status: 400 }
    );
  }

  const reviewId = `${bookingId}_${reviewerRole}`;
  if (data.reviews.some((r) => r.id === reviewId)) {
    return mockJson({ error: "You already reviewed this booking" }, { status: 409 });
  }

  const revieweeId = reviewerRole === "player" ? court.ownerId : booking.userId;
  const targetType = reviewerRole === "player" ? "court_owner" : "player";
  const now = new Date().toISOString();

  const row: MockApiReviewRow = {
    id: reviewId,
    bookingId,
    courtId: booking.courtId,
    playerId: booking.userId,
    ownerId: court.ownerId,
    reviewerId,
    reviewerRole,
    revieweeId,
    targetType,
    rating: normalizedRating,
    comment: normalizedComment,
    createdAt: now,
    updatedAt: now,
  };
  data.reviews.push(row);

  if (reviewerRole === "player") {
    const courtAverage = getUpdatedAverage(court.rating, court.reviewCount, normalizedRating);
    court.rating = courtAverage.rating;
    court.reviewCount = courtAverage.count;
    const host = data.users[court.ownerId];
    if (host) {
      const o = getUpdatedAverage(host.ownerRating, host.ownerReviewCount, normalizedRating);
      host.ownerRating = o.rating;
      host.ownerReviewCount = o.count;
    }
  } else {
    const player = data.users[booking.userId];
    if (player) {
      const p = getUpdatedAverage(
        player.playerRating,
        player.playerReviewCount,
        normalizedRating
      );
      player.playerRating = p.rating;
      player.playerReviewCount = p.count;
    }
  }

  return mockJson({ success: true });
}

export async function mockCreateCheckoutSessionPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const userId = tryGetMockApiUserId(authHeader);
  if (!userId) {
    return mockJson(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const { data, pendingCheckouts } = getState();
  let body: {
    courtId?: string;
    date?: string;
    time?: string;
    durationMinutes?: number;
    courtNumber?: number;
    guestCount?: number;
    initialMessage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return mockJson({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { courtId, date, time, durationMinutes, courtNumber, guestCount, initialMessage } = body;
  if (!courtId || !date || !time || durationMinutes == null) {
    return mockJson({ error: "Missing required fields" }, { status: 400 });
  }

  const durationMinutesNum = Number(durationMinutes);
  if (
    !Number.isInteger(durationMinutesNum) ||
    durationMinutesNum <= 0 ||
    durationMinutesNum > 180
  ) {
    return mockJson(
      { error: "Invalid duration. Must be between 1 and 180 minutes." },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return mockJson({ error: "Invalid date format" }, { status: 400 });
  }

  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (bookingDate < today) {
    return mockJson({ error: "Cannot book courts in the past" }, { status: 400 });
  }

  const court = getCourt(data, courtId);
  if (!court) {
    return mockJson({ error: "Court not found" }, { status: 404 });
  }

  const guestCountNum = guestCount == null ? 1 : Number(guestCount);
  if (!Number.isInteger(guestCountNum) || guestCountNum < 1) {
    return mockJson({ error: "Guest count must be at least 1" }, { status: 400 });
  }
  if (
    typeof court.maxGuests === "number" &&
    court.maxGuests > 0 &&
    guestCountNum > court.maxGuests
  ) {
    return mockJson(
      { error: `This court allows up to ${court.maxGuests} guests` },
      { status: 400 }
    );
  }
  const normalizedInitialMessage =
    typeof initialMessage === "string" ? initialMessage.trim().slice(0, 1000) : "";

  const maxAdvanceDays = court.maxAdvanceBookingDays;
  if (maxAdvanceDays != null && typeof maxAdvanceDays === "number") {
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
    if (bookingDate > maxDate) {
      return mockJson(
        { error: `Bookings are only available up to ${maxAdvanceDays} days in advance` },
        { status: 400 }
      );
    }
  }

  const courtNumberNum = courtNumber ? Number(courtNumber) : 1;
  const blockedTimes = court.blockedTimes || {};
  const blockedTimesForDate = blockedTimes[date] || [];
  const alwaysBlocked = court.alwaysBlockedTimes || [];
  const dayOfWeek = new Date(date).getDay();
  const alwaysBlockedForDay = court.alwaysBlockedTimesByDay?.[dayOfWeek] || [];
  const time24 = convertTo24Hour(time);
  const allBlockedSet = new Set([
    ...blockedTimesForDate,
    ...alwaysBlocked,
    ...alwaysBlockedForDay,
  ]);
  const numCourts = court.numberOfCourts ?? 1;
  if (numCourts > 1 && courtNumberNum) {
    const courtKey = String(courtNumberNum);
    const courtSpecificAlways =
      (court.courtSpecificAlwaysBlockedTimes || {})[courtKey] || [];
    const courtSpecificForDay =
      ((court.courtSpecificAlwaysBlockedTimesByDay || {})[courtKey] || {})[
        String(dayOfWeek)
      ] || [];
    courtSpecificAlways.forEach((t: string) => allBlockedSet.add(t));
    courtSpecificForDay.forEach((t: string) => allBlockedSet.add(t));
  }

  const [startHour] = time24.split(":").map(Number);
  const durationHours = Math.ceil(durationMinutesNum / 60);
  for (let i = 0; i < durationHours; i++) {
    const hour = startHour + i;
    const hourStr = hour.toString().padStart(2, "0") + ":00";
    if (allBlockedSet.has(hourStr)) {
      return mockJson(
        { error: "This booking would overlap with blocked time slots" },
        { status: 409 }
      );
    }
  }

  for (const booking of data.bookings) {
    if (booking.courtId !== courtId || booking.date !== date) continue;
    const bookingCourtNum = booking.courtNumber || 1;
    if (bookingCourtNum !== courtNumberNum) continue;
    if (booking.status === "confirmed" || isActionablePendingBooking(booking)) {
      const existingDurationMinutes =
        booking.durationMinutes || (booking.duration || 1) * 60;
      const existingDuration = Math.ceil(existingDurationMinutes / 60);
      if (timeRangesOverlap(time, durationHours, booking.time, existingDuration)) {
        return mockJson(
          { error: "This time slot is already booked" },
          { status: 409 }
        );
      }
    }
  }

  const pricePerHour = Number(court.price);
  if (Number.isNaN(pricePerHour) || pricePerHour <= 0) {
    return mockJson({ error: "Invalid court pricing" }, { status: 400 });
  }

  const ownerId = court.ownerId;
  if (!ownerId) {
    return mockJson({ error: "Court host not found" }, { status: 404 });
  }
  if (ownerId === userId) {
    return mockJson(
      { error: "Hosts cannot book their own courts" },
      { status: 403 }
    );
  }

  const priceBreakdown = calculateBookingPriceBreakdown(pricePerHour, durationMinutesNum);
  const { totalAmountCents } = priceBreakdown;
  if (totalAmountCents < 100 || totalAmountCents > 100000) {
    return mockJson({ error: "Invalid booking amount" }, { status: 400 });
  }
  if (priceBreakdown.applicationFeeCents >= totalAmountCents) {
    return mockJson(
      {
        error:
          "This booking amount is too low to cover card processing. Try a longer booking or contact support.",
      },
      { status: 400 }
    );
  }

  const sessionId = `mock_cs_${makeMockId()}`;
  pendingCheckouts.set(sessionId, {
    userId,
    courtId,
    date,
    time,
    durationMinutes: durationMinutesNum,
    courtNumber: courtNumberNum,
    guestCount: guestCountNum,
    initialMessage: normalizedInitialMessage,
  });

  const url = `${requestOrigin(req)}/success?session_id=${encodeURIComponent(sessionId)}`;
  return mockJson({ url });
}

export async function mockFinalizeCheckoutSessionPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const userId = tryGetMockApiUserId(authHeader);
  if (!userId) {
    return mockJson(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }

  const { data, pendingCheckouts } = getState();
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    body = { sessionId: "" };
  }
  const sessionId = body.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return mockJson({ error: "Missing checkout session" }, { status: 400 });
  }

  const existing = data.bookings.find((b) => b.sessionId === sessionId);
  if (existing) {
    return mockJson({
      status: "existing" as const,
      bookingId: existing.id,
      conversationId: existing.conversationId,
    });
  }

  const pending = pendingCheckouts.get(sessionId);
  if (!pending || pending.userId !== userId) {
    return mockJson(
      { error: "Checkout session does not belong to this user" },
      { status: 403 }
    );
  }

  const court = getCourt(data, pending.courtId);
  if (!court) {
    return mockJson({ error: "Court not found" }, { status: 404 });
  }

  const priceBreakdown = calculateBookingPriceBreakdown(
    court.price,
    pending.durationMinutes
  );

  const bookingId = `mock-booking-${makeMockId()}`;
  const conversationId = `booking_${bookingId}`;
  const now = new Date();
  const booking: MockApiBookingRow = {
    id: bookingId,
    courtId: pending.courtId,
    userId: pending.userId,
    date: pending.date,
    time: pending.time,
    duration: pending.durationMinutes / 60,
    durationMinutes: pending.durationMinutes,
    status: "pending",
    courtNumber: pending.courtNumber,
    guestCount: pending.guestCount,
    initialMessage: pending.initialMessage,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    sessionId,
    paymentIntentId: `pi_mock_${makeMockId()}`,
    paymentStatus: "authorized",
    totalAmountCents: priceBreakdown.totalAmountCents,
    conversationId,
  };

  data.bookings.push(booking);
  pendingCheckouts.delete(sessionId);

  return mockJson({
    status: "created" as const,
    bookingId,
    conversationId,
  });
}

export async function mockAcceptBookingPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const ownerId = tryGetMockApiUserId(authHeader);
  if (!ownerId) {
    return mockJson(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const { data } = getState();
  let body: { bookingId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const bookingId = body.bookingId;
  if (!bookingId) {
    return mockJson({ error: "Booking ID is required" }, { status: 400 });
  }

  const booking = getBooking(data, bookingId);
  if (!booking) {
    return mockJson({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "pending") {
    return mockJson({ error: "Booking is no longer pending" }, { status: 400 });
  }

  const court = getCourt(data, booking.courtId);
  if (!court || court.ownerId !== ownerId) {
    return mockJson(
      { error: "Only the court host can accept this booking" },
      { status: 403 }
    );
  }

  if (!isActionablePendingBooking(booking)) {
    booking.status = "expired";
    booking.cancelReason = "host_acceptance_window_expired";
    return mockJson(
      { error: "This booking request has expired" },
      { status: 409 }
    );
  }

  booking.status = "confirmed";
  booking.paymentStatus = "captured";
  booking.confirmedAt = new Date().toISOString();

  return mockJson({ success: true, paymentStatus: "captured" });
}

export async function mockRejectBookingPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const userId = tryGetMockApiUserId(authHeader);
  if (!userId) {
    return mockJson(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const { data } = getState();
  let body: { bookingId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const bookingId = body.bookingId;
  if (!bookingId) {
    return mockJson({ error: "Booking ID is required" }, { status: 400 });
  }

  const booking = getBooking(data, bookingId);
  if (!booking) {
    return mockJson({ error: "Booking not found" }, { status: 404 });
  }

  const court = getCourt(data, booking.courtId);
  if (!court || court.ownerId !== userId) {
    return mockJson(
      { error: "Only the court host can reject bookings" },
      { status: 403 }
    );
  }

  if (booking.status === "rejected") {
    return mockJson({ error: "Booking is already rejected" }, { status: 400 });
  }

  booking.status = "rejected";
  booking.paymentStatus = "canceled";
  booking.rejectedAt = new Date().toISOString();

  return mockJson({ success: true });
}

export async function mockCancelBookingPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const userId = tryGetMockApiUserId(authHeader);
  if (!userId) {
    return mockJson(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }

  const { data } = getState();
  let body: { bookingId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const bookingId = body.bookingId;
  if (!bookingId) {
    return mockJson({ error: "Booking ID is required" }, { status: 400 });
  }

  const booking = getBooking(data, bookingId);
  if (!booking) {
    return mockJson({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.userId !== userId) {
    return mockJson(
      { error: "You can only cancel your own bookings" },
      { status: 403 }
    );
  }
  if (booking.status === "cancelled") {
    return mockJson({ error: "Booking is already cancelled" }, { status: 400 });
  }

  booking.status = "cancelled";
  booking.paymentStatus = "canceled";
  booking.cancelReason = "player_cancellation";

  return mockJson({ success: true });
}

export async function mockExpirePendingBookingsPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const ownerId = tryGetMockApiUserId(authHeader);
  if (!ownerId) {
    return mockJson(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const { data } = getState();
  let body: { bookingIds?: unknown };
  try {
    body = await req.json();
  } catch {
    body = { bookingIds: [] };
  }
  const bookingIds = Array.isArray(body.bookingIds) ? body.bookingIds : [];
  if (bookingIds.length === 0) {
    return mockJson({ expiredBookingIds: [] });
  }

  const expiredBookingIds: string[] = [];

  for (const bookingId of bookingIds) {
    if (typeof bookingId !== "string") continue;
    const booking = getBooking(data, bookingId);
    if (!booking || booking.status !== "pending") continue;
    const court = getCourt(data, booking.courtId);
    if (!court || court.ownerId !== ownerId) continue;
    if (!isPendingBookingExpired(booking)) continue;
    booking.status = "expired";
    booking.cancelReason = "host_acceptance_window_expired";
    booking.paymentStatus = "canceled";
    expiredBookingIds.push(bookingId);
  }

  return mockJson({ expiredBookingIds });
}

export async function mockCreateConnectAccountPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const userId = tryGetMockApiUserId(authHeader);
  if (!userId) {
    return mockJson(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }

  let requestBody: { update?: boolean } = {};
  try {
    const text = await req.text();
    if (text) requestBody = JSON.parse(text);
  } catch {
    requestBody = {};
  }

  const origin = requestOrigin(req);
  if (requestBody.update === true) {
    return mockJson({
      accountId: "acct_mock_connect",
      updateUrl: `${origin}/host?mock_stripe=express`,
      status: "active",
      requirementsCurrentlyDue: [],
      requirementsPastDue: [],
      requirementsEventuallyDue: [],
      disabledReason: null,
    });
  }

  return mockJson({
    accountId: "acct_mock_connect",
    onboardingUrl: `${origin}/host?mock_stripe=onboarding`,
    status: "pending",
    requirementsCurrentlyDue: [],
    requirementsPastDue: [],
    requirementsEventuallyDue: [],
    disabledReason: null,
  });
}

export async function mockCheckAccountStatusPOST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  const userId = tryGetMockApiUserId(authHeader);
  if (!userId) {
    return mockJson(
      { error: "Invalid or expired authentication token" },
      { status: 401 }
    );
  }

  return mockJson({
    hasAccount: false,
    status: "none",
    mode: "test",
  });
}

export async function mockStripeWebhookPOST(): Promise<NextResponse> {
  return mockJson(
    {
      error:
        "Stripe webhooks are disabled in MOCK_API mode. Use mock checkout (create-checkout-session + finalize-checkout-session) instead.",
    },
    { status: 400 }
  );
}

export async function mockSendBookingConfirmationBody(body: {
  bookingId?: string;
}): Promise<NextResponse> {
  if (!body.bookingId) {
    return mockJson({ error: "Booking ID is required" }, { status: 400 });
  }
  const { data } = getState();
  if (!getBooking(data, body.bookingId)) {
    return mockJson({ error: "Booking not found" }, { status: 404 });
  }
  return mockJson({ success: true, emailSent: true });
}
