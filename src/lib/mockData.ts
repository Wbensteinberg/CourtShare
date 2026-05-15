"use client";

import type { User } from "firebase/auth";
import { theme } from "./theme";

export type MockUserProfile = {
  uid: string;
  email: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  isOwner: boolean;
  playerRating?: number;
  playerReviewCount?: number;
  ownerRating?: number;
  ownerReviewCount?: number;
  /** ISO string — used for “months on CourtShare” in profile-style UIs */
  createdAt?: string;
};

export type MockCourt = {
  id: string;
  name: string;
  location: string;
  address?: string;
  accessInstructions?: string;
  price: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  ownerId: string;
  latitude?: number;
  longitude?: number;
  numberOfCourts?: number;
  blockedDates?: string[];
  blockedTimes?: Record<string, string[]>;
  maxAdvanceBookingDays?: number | null;
  alwaysBlockedTimes?: string[];
  alwaysBlockedTimesByDay?: Record<number, string[]>;
  courtSpecificAlwaysBlockedTimes?: Record<string, string[]>;
  courtSpecificAlwaysBlockedTimesByDay?: Record<string, Record<string, string[]>>;
  surface?: string;
  indoor?: boolean;
  amenities?: string[];
  rating?: number;
  reviewCount?: number;
};

export type MockBooking = {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  cancelReason?: string;
  declineReason?: string;
  courtNumber?: number;
  guestCount?: number;
  initialMessage?: string;
  createdAt?: string;
  sessionId?: string;
  conversationId?: string;
};

export type MockConversation = {
  id: string;
  participantIds: string[];
  playerId: string;
  playerName?: string;
  ownerId: string;
  ownerName?: string;
  courtId: string;
  courtName?: string;
  bookingId?: string;
  bookingDate?: string;
  bookingTime?: string;
  bookingDurationMinutes?: number;
  bookingCourtNumber?: number;
  status: "inquiry" | "booking_pending" | "confirmed" | "closed";
  lastMessageText: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadBy: string[];
  createdAt: string;
  updatedAt: string;
};

export type MockMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  type: "text" | "booking_request" | "booking_status" | "system";
  bookingId?: string;
  courtId?: string;
  status?: "accepted" | "declined" | "cancelled";
  declineReason?: string;
  paymentStatus?: "authorization_released" | "refunded" | "no_payment";
};

export type MockReview = {
  id: string;
  bookingId: string;
  courtId: string;
  playerId: string;
  ownerId: string;
  reviewerId: string;
  reviewerRole: "player" | "owner";
  revieweeId: string;
  targetType: "court_owner" | "player";
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

type MockDb = {
  users: Record<string, MockUserProfile>;
  courts: MockCourt[];
  bookings: MockBooking[];
  conversations: MockConversation[];
  messages: MockMessage[];
  reviews: MockReview[];
};

type MockSession = {
  loggedIn: boolean;
  uid: string;
};

const DB_STORAGE_KEY = "courtshare.mock.db.v1";
const SESSION_STORAGE_KEY = "courtshare.mock.session.v1";
const ACTIVE_USER_ID = "mock-user-1";

let memoryDb: MockDb | null = null;
let memorySession: MockSession | null = null;

const isClient = () => typeof window !== "undefined";
const MOCK_AUTH_EVENT = "courtshare:mock-auth-changed";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const formatBookingRequestMessage = (
  courtName: string | undefined,
  date: string,
  time: string,
  duration: number,
  courtNumber?: number
) => {
  const durationLabel = Number.isInteger(duration)
    ? String(duration)
    : duration.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const courtNumberText =
    courtNumber && courtNumber > 1 ? `, Court ${courtNumber}` : "";
  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));

  return `New booking request for ${
    courtName || "this court"
  }${courtNumberText} on ${formattedDate} at ${time} for ${durationLabel} hour${
    duration === 1 ? "" : "s"
  }.`;
};

const buildMockConversationForBooking = (
  db: MockDb,
  booking: MockBooking,
  now = new Date().toISOString()
) => {
  const court = db.courts.find((item) => item.id === booking.courtId);
  const player = db.users[booking.userId];
  const owner = court ? db.users[court.ownerId] : null;
  const conversationId = `booking_${booking.id}`;
  const bookingRequestText = formatBookingRequestMessage(
    court?.name,
    booking.date,
    booking.time,
    booking.duration,
    booking.courtNumber
  );
  const initialMessage = booking.initialMessage?.trim().slice(0, 1000) || "";
  const lastMessageText = initialMessage || bookingRequestText;
  const existingConversation = db.conversations.find(
    (conversation) => conversation.id === conversationId
  );

  return {
    conversation: {
      id: conversationId,
      participantIds: [booking.userId, court?.ownerId || ""].filter(Boolean),
      playerId: booking.userId,
      playerName: player?.displayName,
      ownerId: court?.ownerId || "",
      ownerName: owner?.displayName,
      courtId: booking.courtId,
      courtName: court?.name,
      bookingId: booking.id,
      bookingDate: booking.date,
      bookingTime: booking.time,
      bookingDurationMinutes: Math.round(booking.duration * 60),
      bookingCourtNumber: booking.courtNumber || 1,
      status: "booking_pending" as const,
      lastMessageText,
      lastMessageAt: existingConversation?.lastMessageAt || now,
      lastMessageSenderId: booking.userId,
      unreadBy: court?.ownerId ? [court.ownerId] : [],
      createdAt: existingConversation?.createdAt || booking.createdAt || now,
      updatedAt: existingConversation?.updatedAt || now,
    },
    message: {
      id: "booking_request",
      conversationId,
      senderId: booking.userId,
      body: bookingRequestText,
      createdAt: booking.createdAt || now,
      type: "booking_request" as const,
      bookingId: booking.id,
      courtId: booking.courtId,
    },
    initialMessage: initialMessage
      ? {
          id: "initial_message",
          conversationId,
          senderId: booking.userId,
          body: initialMessage,
          createdAt: booking.createdAt || now,
          type: "text" as const,
          bookingId: booking.id,
          courtId: booking.courtId,
        }
      : null,
  };
};

const formatDateOffset = (daysFromToday: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
};

const seedIsoDaysAgo = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

const createImageDataUrl = (title: string, accent: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <circle cx="980" cy="180" r="120" fill="rgba(255,255,255,0.08)" />
      <circle cx="180" cy="660" r="180" fill="rgba(255,255,255,0.10)" />
      <rect x="80" y="140" width="1040" height="520" rx="36" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" />
      <path d="M120 400 H1080" stroke="rgba(255,255,255,0.45)" stroke-width="8" stroke-dasharray="18 16" />
      <path d="M600 160 V640" stroke="rgba(255,255,255,0.45)" stroke-width="8" />
      <text x="96" y="110" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">CourtShare Demo</text>
      <text x="96" y="710" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800">${title}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const createAvatarDataUrl = (initials: string, accent: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <rect width="160" height="160" rx="80" fill="${accent}" />
      <circle cx="122" cy="36" r="30" fill="rgba(255,255,255,0.16)" />
      <circle cx="38" cy="126" r="42" fill="rgba(255,255,255,0.12)" />
      <text x="80" y="94" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const mockMemberSinceMonthsAgo = (monthsAgo: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString();
};

const createSeedDb = (): MockDb => {
  const activeUser: MockUserProfile = {
    uid: ACTIVE_USER_ID,
    email: "demo@courtshare.co",
    displayName: "Riley Chen",
    bio: "League player, early-morning hitter, and part-time court host.",
    profileImageUrl: createAvatarDataUrl("RC", "#1b2534"),
    isOwner: false,
    createdAt: mockMemberSinceMonthsAgo(10),
  };

  const guestUser: MockUserProfile = {
    uid: "mock-user-2",
    email: "jamie@courtshare.co",
    displayName: "Jamie Brooks",
    bio: "Weekend doubles player.",
    profileImageUrl: createAvatarDataUrl("JB", "#0f766e"),
    isOwner: false,
    createdAt: mockMemberSinceMonthsAgo(14),
  };

  const guestUserTwo: MockUserProfile = {
    uid: "mock-user-3",
    email: "taylor@courtshare.co",
    displayName: "Taylor Morgan",
    bio: "Competitive USTA player.",
    profileImageUrl: createAvatarDataUrl("TM", "#334155"),
    isOwner: false,
    createdAt: mockMemberSinceMonthsAgo(5),
  };

  const courts: MockCourt[] = [
    {
      id: "mock-court-1",
      name: "Sunset Baseline Club",
      location: "Santa Monica, CA",
      address: "1432 Ocean Park Blvd, Santa Monica, CA",
      accessInstructions: "Check in with the front desk and use court gate code 4411.",
      price: 48,
      description: "Bright outdoor hard courts with shade seating, water refill, and quick freeway access.",
      imageUrl: createImageDataUrl("Sunset Baseline Club", theme.colors.brandGreen),
      imageUrls: [createImageDataUrl("Sunset Baseline Club", theme.colors.brandGreen)],
      ownerId: "mock-user-2",
      latitude: 34.0195,
      longitude: -118.4912,
      numberOfCourts: 2,
      blockedDates: [],
      blockedTimes: {},
      maxAdvanceBookingDays: 21,
      alwaysBlockedTimes: ["21:00"],
      alwaysBlockedTimesByDay: { 0: ["08:00"], 6: ["08:00"] },
      surface: "Hard Court",
      indoor: false,
      amenities: ["Parking", "WiFi", "Changing Rooms"],
      rating: 4.9,
      reviewCount: 34,
    },
    {
      id: "mock-court-2",
      name: "Echo Valley Tennis",
      location: "Pasadena, CA",
      address: "815 Arroyo Pkwy, Pasadena, CA",
      accessInstructions: "Parking lot entrance is on the south side of the building.",
      price: 36,
      description: "Clean public-private hybrid facility with easy parking and a steady after-work crowd.",
      imageUrl: createImageDataUrl("Echo Valley Tennis", "#0ea5e9"),
      imageUrls: [createImageDataUrl("Echo Valley Tennis", "#0ea5e9")],
      ownerId: "mock-user-3",
      latitude: 34.1478,
      longitude: -118.1445,
      numberOfCourts: 1,
      blockedDates: [],
      blockedTimes: {},
      maxAdvanceBookingDays: 14,
      alwaysBlockedTimes: [],
      alwaysBlockedTimesByDay: {},
      surface: "Clay",
      indoor: false,
      amenities: ["Parking", "Changing Rooms"],
      rating: 4.7,
      reviewCount: 23,
    },
    {
      id: "mock-court-3",
      name: "Riley's Match Point Courts",
      location: "Culver City, CA",
      address: "4114 Hayden Ave, Culver City, CA",
      accessInstructions: "Use the keypad at the side gate and keep noise low after 8 PM.",
      price: 62,
      description: "Premium private courts with lounge seating, string lights, and polished owner-side amenities.",
      imageUrl: createImageDataUrl("Match Point Courts", "#f59e0b"),
      imageUrls: [createImageDataUrl("Match Point Courts", "#f59e0b")],
      ownerId: ACTIVE_USER_ID,
      latitude: 34.0211,
      longitude: -118.3965,
      numberOfCourts: 2,
      blockedDates: [],
      blockedTimes: {
        [formatDateOffset(2)]: ["18:00"],
      },
      maxAdvanceBookingDays: 30,
      alwaysBlockedTimes: ["06:00"],
      alwaysBlockedTimesByDay: { 1: ["07:00"], 3: ["07:00"] },
      courtSpecificAlwaysBlockedTimes: { "2": ["17:00"] },
      courtSpecificAlwaysBlockedTimesByDay: { "2": { "5": ["18:00"] } },
      surface: "Hard Court",
      indoor: true,
      amenities: ["Parking", "WiFi", "Changing Rooms"],
      rating: 4.95,
      reviewCount: 18,
    },
  ];

  const nowIso = new Date().toISOString();

  const bookings: MockBooking[] = [
    {
      id: "mock-booking-1",
      courtId: "mock-court-1",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(2),
      time: "7:00 PM",
      duration: 2,
      status: "confirmed",
      courtNumber: 1,
      createdAt: nowIso,
      sessionId: "mock-session-1",
    },
    {
      id: "mock-booking-2",
      courtId: "mock-court-2",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(5),
      time: "8:00 AM",
      duration: 1,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      sessionId: "mock-session-2",
    },
    {
      id: "mock-booking-3",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(3),
      time: "5:00 PM",
      duration: 1,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      sessionId: "mock-session-3",
    },
    {
      id: "mock-booking-4",
      courtId: "mock-court-3",
      userId: "mock-user-3",
      date: formatDateOffset(-2),
      time: "10:00 AM",
      duration: 2,
      status: "completed",
      courtNumber: 2,
      createdAt: seedIsoDaysAgo(4),
      sessionId: "mock-session-4",
    },
    {
      id: "mock-seed-p1",
      courtId: "mock-court-1",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-14),
      time: "10:00 AM",
      duration: 1,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(15),
      sessionId: "mock-session-p1",
    },
    {
      id: "mock-seed-p2",
      courtId: "mock-court-2",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-21),
      time: "4:00 PM",
      duration: 2,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(22),
      sessionId: "mock-session-p2",
    },
    {
      id: "mock-seed-p3",
      courtId: "mock-court-1",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-35),
      time: "9:00 AM",
      duration: 1,
      status: "completed",
      courtNumber: 2,
      createdAt: seedIsoDaysAgo(36),
      sessionId: "mock-session-p3",
    },
    {
      id: "mock-seed-p4",
      courtId: "mock-court-2",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-7),
      time: "11:00 AM",
      duration: 1,
      status: "cancelled",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(9),
      sessionId: "mock-session-p4",
    },
    {
      id: "mock-seed-p5",
      courtId: "mock-court-1",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-10),
      time: "2:00 PM",
      duration: 1,
      status: "rejected",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(11),
      sessionId: "mock-session-p5",
    },
    {
      id: "mock-seed-p6",
      courtId: "mock-court-2",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-45),
      time: "8:00 AM",
      duration: 1,
      status: "expired",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(50),
      sessionId: "mock-session-p6",
    },
    {
      id: "mock-seed-p7",
      courtId: "mock-court-1",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(10),
      time: "6:30 PM",
      duration: 1,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      sessionId: "mock-session-p7",
    },
    {
      id: "mock-seed-p8",
      courtId: "mock-court-1",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-8),
      time: "1:00 PM",
      duration: 1,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(9),
      sessionId: "mock-session-p8",
    },
    {
      id: "mock-seed-p9",
      courtId: "mock-court-2",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-3),
      time: "3:00 PM",
      duration: 1,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(4),
      sessionId: "mock-session-p9",
    },
    {
      id: "mock-host-past1",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(-30),
      time: "3:00 PM",
      duration: 2,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(31),
      sessionId: "mock-session-hp1",
    },
    {
      id: "mock-host-past2",
      courtId: "mock-court-3",
      userId: "mock-user-3",
      date: formatDateOffset(-18),
      time: "1:00 PM",
      duration: 2,
      status: "completed",
      courtNumber: 2,
      createdAt: seedIsoDaysAgo(19),
      sessionId: "mock-session-hp2",
    },
    {
      id: "mock-host-past3",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(-5),
      time: "7:00 PM",
      duration: 1,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(6),
      sessionId: "mock-session-hp3",
    },
    {
      id: "mock-host-req2",
      courtId: "mock-court-3",
      userId: "mock-user-3",
      date: formatDateOffset(7),
      time: "9:00 AM",
      duration: 1,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      sessionId: "mock-session-hr2",
    },
    {
      id: "mock-host-req3",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(12),
      time: "4:00 PM",
      duration: 2,
      status: "pending",
      courtNumber: 2,
      createdAt: nowIso,
      sessionId: "mock-session-hr3",
    },
    {
      id: "mock-seed-j1",
      courtId: "mock-court-1",
      userId: "mock-user-3",
      date: formatDateOffset(-11),
      time: "5:00 PM",
      duration: 1,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(12),
      sessionId: "mock-session-j1",
    },
    {
      id: "mock-seed-t1",
      courtId: "mock-court-2",
      userId: "mock-user-2",
      date: formatDateOffset(-12),
      time: "10:00 AM",
      duration: 2,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(13),
      sessionId: "mock-session-t1",
    },
    {
      id: "mock-seed-t2",
      courtId: "mock-court-2",
      userId: "mock-user-2",
      date: formatDateOffset(-20),
      time: "2:00 PM",
      duration: 1,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(21),
      sessionId: "mock-session-t2",
    },
    {
      id: "mock-booking-open-review",
      courtId: "mock-court-1",
      userId: ACTIVE_USER_ID,
      date: formatDateOffset(-1),
      time: "6:00 PM",
      duration: 1,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(2),
      sessionId: "mock-session-open-review",
    },
  ];

  const reviews: MockReview[] = [
    {
      id: "mock-seed-p1_player",
      bookingId: "mock-seed-p1",
      courtId: "mock-court-1",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "player",
      revieweeId: "mock-user-2",
      targetType: "court_owner",
      rating: 5,
      comment:
        "Jamie's club was spotless and the lights made evening singles easy to track. Would book again.",
      createdAt: seedIsoDaysAgo(13),
      updatedAt: seedIsoDaysAgo(13),
    },
    {
      id: "mock-seed-p1_owner",
      bookingId: "mock-seed-p1",
      courtId: "mock-court-1",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: "mock-user-2",
      reviewerRole: "owner",
      revieweeId: ACTIVE_USER_ID,
      targetType: "player",
      rating: 5,
      comment: "Riley showed up on time, respected court rotation, and left the bench area tidy.",
      createdAt: seedIsoDaysAgo(13),
      updatedAt: seedIsoDaysAgo(13),
    },
    {
      id: "mock-seed-p2_player",
      bookingId: "mock-seed-p2",
      courtId: "mock-court-2",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "player",
      revieweeId: "mock-user-3",
      targetType: "court_owner",
      rating: 5,
      comment: "Clay was well watered and Taylor was responsive when I asked about parking.",
      createdAt: seedIsoDaysAgo(20),
      updatedAt: seedIsoDaysAgo(20),
    },
    {
      id: "mock-seed-p2_owner",
      bookingId: "mock-seed-p2",
      courtId: "mock-court-2",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: "mock-user-3",
      reviewerRole: "owner",
      revieweeId: ACTIVE_USER_ID,
      targetType: "player",
      rating: 5,
      comment: "Great energy and clear communication about arrival time.",
      createdAt: seedIsoDaysAgo(20),
      updatedAt: seedIsoDaysAgo(20),
    },
    {
      id: "mock-seed-p3_player",
      bookingId: "mock-seed-p3",
      courtId: "mock-court-1",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "player",
      revieweeId: "mock-user-2",
      targetType: "court_owner",
      rating: 4,
      comment: "Solid experience overall; only nit is the water fountain was being serviced.",
      createdAt: seedIsoDaysAgo(34),
      updatedAt: seedIsoDaysAgo(34),
    },
    {
      id: "mock-seed-p3_owner",
      bookingId: "mock-seed-p3",
      courtId: "mock-court-1",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: "mock-user-2",
      reviewerRole: "owner",
      revieweeId: ACTIVE_USER_ID,
      targetType: "player",
      rating: 4,
      comment: "Easy guest to host—no issues with gate code or noise.",
      createdAt: seedIsoDaysAgo(34),
      updatedAt: seedIsoDaysAgo(34),
    },
    {
      id: "mock-seed-p8_player",
      bookingId: "mock-seed-p8",
      courtId: "mock-court-1",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "player",
      revieweeId: "mock-user-2",
      targetType: "court_owner",
      rating: 5,
      comment: "Quick midday hit; court 1 played true and the shade sails helped a lot.",
      createdAt: seedIsoDaysAgo(7),
      updatedAt: seedIsoDaysAgo(7),
    },
    {
      id: "mock-seed-p8_owner",
      bookingId: "mock-seed-p8",
      courtId: "mock-court-1",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: "mock-user-2",
      reviewerRole: "owner",
      revieweeId: ACTIVE_USER_ID,
      targetType: "player",
      rating: 5,
      comment: "Polite and punctual—exactly the kind of guest we want back.",
      createdAt: seedIsoDaysAgo(7),
      updatedAt: seedIsoDaysAgo(7),
    },
    {
      id: "mock-seed-p9_player",
      bookingId: "mock-seed-p9",
      courtId: "mock-court-2",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "player",
      revieweeId: "mock-user-3",
      targetType: "court_owner",
      rating: 5,
      comment: "Echo Valley was quiet and the clay played consistently through the session.",
      createdAt: seedIsoDaysAgo(2),
      updatedAt: seedIsoDaysAgo(2),
    },
    {
      id: "mock-seed-p9_owner",
      bookingId: "mock-seed-p9",
      courtId: "mock-court-2",
      playerId: ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: "mock-user-3",
      reviewerRole: "owner",
      revieweeId: ACTIVE_USER_ID,
      targetType: "player",
      rating: 5,
      comment: "Riley left the court on schedule and locked the side gate as asked.",
      createdAt: seedIsoDaysAgo(2),
      updatedAt: seedIsoDaysAgo(2),
    },
    {
      id: "mock-host-past1_player",
      bookingId: "mock-host-past1",
      courtId: "mock-court-3",
      playerId: "mock-user-2",
      ownerId: ACTIVE_USER_ID,
      reviewerId: "mock-user-2",
      reviewerRole: "player",
      revieweeId: ACTIVE_USER_ID,
      targetType: "court_owner",
      rating: 5,
      comment: "Private courts felt resort-quality—great lighting and lounge area.",
      createdAt: seedIsoDaysAgo(28),
      updatedAt: seedIsoDaysAgo(28),
    },
    {
      id: "mock-host-past1_owner",
      bookingId: "mock-host-past1",
      courtId: "mock-court-3",
      playerId: "mock-user-2",
      ownerId: ACTIVE_USER_ID,
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "owner",
      revieweeId: "mock-user-2",
      targetType: "player",
      rating: 5,
      comment: "Jamie communicated clearly and treated the space respectfully.",
      createdAt: seedIsoDaysAgo(28),
      updatedAt: seedIsoDaysAgo(28),
    },
    {
      id: "mock-host-past2_player",
      bookingId: "mock-host-past2",
      courtId: "mock-court-3",
      playerId: "mock-user-3",
      ownerId: ACTIVE_USER_ID,
      reviewerId: "mock-user-3",
      reviewerRole: "player",
      revieweeId: ACTIVE_USER_ID,
      targetType: "court_owner",
      rating: 5,
      comment: "CourtShare checkout was smooth and Riley's instructions were perfect after dark.",
      createdAt: seedIsoDaysAgo(16),
      updatedAt: seedIsoDaysAgo(16),
    },
    {
      id: "mock-host-past2_owner",
      bookingId: "mock-host-past2",
      courtId: "mock-court-3",
      playerId: "mock-user-3",
      ownerId: ACTIVE_USER_ID,
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "owner",
      revieweeId: "mock-user-3",
      targetType: "player",
      rating: 5,
      comment: "Taylor brought their own balls and was flexible when we swapped courts.",
      createdAt: seedIsoDaysAgo(16),
      updatedAt: seedIsoDaysAgo(16),
    },
    {
      id: "mock-host-past3_player",
      bookingId: "mock-host-past3",
      courtId: "mock-court-3",
      playerId: "mock-user-2",
      ownerId: ACTIVE_USER_ID,
      reviewerId: "mock-user-2",
      reviewerRole: "player",
      revieweeId: ACTIVE_USER_ID,
      targetType: "court_owner",
      rating: 4,
      comment: "Lovely session; only wish the keypad had been lit a bit brighter.",
      createdAt: seedIsoDaysAgo(4),
      updatedAt: seedIsoDaysAgo(4),
    },
    {
      id: "mock-host-past3_owner",
      bookingId: "mock-host-past3",
      courtId: "mock-court-3",
      playerId: "mock-user-2",
      ownerId: ACTIVE_USER_ID,
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "owner",
      revieweeId: "mock-user-2",
      targetType: "player",
      rating: 5,
      comment: "Repeat guest—always leaves the lounge exactly as they found it.",
      createdAt: seedIsoDaysAgo(4),
      updatedAt: seedIsoDaysAgo(4),
    },
    {
      id: "mock-booking-4_player",
      bookingId: "mock-booking-4",
      courtId: "mock-court-3",
      playerId: "mock-user-3",
      ownerId: ACTIVE_USER_ID,
      reviewerId: "mock-user-3",
      reviewerRole: "player",
      revieweeId: ACTIVE_USER_ID,
      targetType: "court_owner",
      rating: 5,
      comment: "Premium vibe and Riley checked in mid-day to confirm court number—nice touch.",
      createdAt: seedIsoDaysAgo(1),
      updatedAt: seedIsoDaysAgo(1),
    },
    {
      id: "mock-booking-4_owner",
      bookingId: "mock-booking-4",
      courtId: "mock-court-3",
      playerId: "mock-user-3",
      ownerId: ACTIVE_USER_ID,
      reviewerId: ACTIVE_USER_ID,
      reviewerRole: "owner",
      revieweeId: "mock-user-3",
      targetType: "player",
      rating: 5,
      comment: "Taylor is organized, friendly, and great with time boundaries.",
      createdAt: seedIsoDaysAgo(1),
      updatedAt: seedIsoDaysAgo(1),
    },
    {
      id: "mock-seed-j1_player",
      bookingId: "mock-seed-j1",
      courtId: "mock-court-1",
      playerId: "mock-user-3",
      ownerId: "mock-user-2",
      reviewerId: "mock-user-3",
      reviewerRole: "player",
      revieweeId: "mock-user-2",
      targetType: "court_owner",
      rating: 5,
      comment: "Front desk staff was welcoming and the hard courts played fast but fair.",
      createdAt: seedIsoDaysAgo(10),
      updatedAt: seedIsoDaysAgo(10),
    },
    {
      id: "mock-seed-j1_owner",
      bookingId: "mock-seed-j1",
      courtId: "mock-court-1",
      playerId: "mock-user-3",
      ownerId: "mock-user-2",
      reviewerId: "mock-user-2",
      reviewerRole: "owner",
      revieweeId: "mock-user-3",
      targetType: "player",
      rating: 4,
      comment: "Strong player—just double-check parking validation next time.",
      createdAt: seedIsoDaysAgo(10),
      updatedAt: seedIsoDaysAgo(10),
    },
    {
      id: "mock-seed-t1_player",
      bookingId: "mock-seed-t1",
      courtId: "mock-court-2",
      playerId: "mock-user-2",
      ownerId: "mock-user-3",
      reviewerId: "mock-user-2",
      reviewerRole: "player",
      revieweeId: "mock-user-3",
      targetType: "court_owner",
      rating: 5,
      comment: "Clay was groomed nicely and Taylor shared local league tips after the hit.",
      createdAt: seedIsoDaysAgo(11),
      updatedAt: seedIsoDaysAgo(11),
    },
    {
      id: "mock-seed-t1_owner",
      bookingId: "mock-seed-t1",
      courtId: "mock-court-2",
      playerId: "mock-user-2",
      ownerId: "mock-user-3",
      reviewerId: "mock-user-3",
      reviewerRole: "owner",
      revieweeId: "mock-user-2",
      targetType: "player",
      rating: 5,
      comment: "Jamie is courteous and left the clay court lines easy to read for the next group.",
      createdAt: seedIsoDaysAgo(11),
      updatedAt: seedIsoDaysAgo(11),
    },
    {
      id: "mock-seed-t2_player",
      bookingId: "mock-seed-t2",
      courtId: "mock-court-2",
      playerId: "mock-user-2",
      ownerId: "mock-user-3",
      reviewerId: "mock-user-2",
      reviewerRole: "player",
      revieweeId: "mock-user-3",
      targetType: "court_owner",
      rating: 5,
      comment:
        "Taylor resurfaced this court since my last visit; footwork felt predictable and fun.",
      createdAt: seedIsoDaysAgo(19),
      updatedAt: seedIsoDaysAgo(19),
    },
    {
      id: "mock-seed-t2_owner",
      bookingId: "mock-seed-t2",
      courtId: "mock-court-2",
      playerId: "mock-user-2",
      ownerId: "mock-user-3",
      reviewerId: "mock-user-3",
      reviewerRole: "owner",
      revieweeId: "mock-user-2",
      targetType: "player",
      rating: 5,
      comment: "Jamie gave a heads-up when running a few minutes late - much appreciated.",
      createdAt: seedIsoDaysAgo(19),
      updatedAt: seedIsoDaysAgo(19),
    },
  ];

  const db: MockDb = {
    users: {
      [activeUser.uid]: activeUser,
      [guestUser.uid]: guestUser,
      [guestUserTwo.uid]: guestUserTwo,
    },
    courts,
    bookings,
    conversations: [],
    messages: [],
    reviews,
  };

  bookings.forEach((booking) => {
	    const { conversation, message, initialMessage } = buildMockConversationForBooking(
	      db,
	      booking
	    );
	    db.conversations.push(conversation);
	    db.messages.push(message);
	    if (initialMessage) db.messages.push(initialMessage);
  });

  return db;
};

const createDefaultSession = (): MockSession => ({
  loggedIn: true,
  uid: ACTIVE_USER_ID,
});

const readStorage = <T,>(key: string): T | null => {
  if (!isClient()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: unknown) => {
  if (!isClient()) return;

  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeMockDb = (db: MockDb): MockDb => {
  const users =
    db.users && typeof db.users === "object" && !Array.isArray(db.users)
      ? db.users
      : {};
  const courts = Array.isArray(db.courts) ? db.courts : [];
  const bookings = Array.isArray(db.bookings) ? db.bookings : [];
  const reviews = Array.isArray(db.reviews) ? db.reviews : [];
  const conversations = Array.isArray(db.conversations) ? db.conversations : [];
  const messages = Array.isArray(db.messages) ? db.messages : [];

  const normalized: MockDb = {
    users,
    courts,
    bookings,
    reviews,
    conversations,
    messages,
  };

  normalized.bookings.forEach((booking) => {
    const conversationId = `booking_${booking.id}`;
    if (
      !normalized.conversations.some(
        (conversation) => conversation.id === conversationId
      )
    ) {
	      const { conversation, message, initialMessage } = buildMockConversationForBooking(
	        normalized,
	        booking
	      );
	      normalized.conversations.push(conversation);
	      normalized.messages.push(message);
	      if (initialMessage) normalized.messages.push(initialMessage);
      booking.conversationId = conversationId;
    }
  });

  // Persisted mock DBs from older builds often omitted `reviews` or normalized it to
  // `[]`, so every review modal read an empty list. Re-seed reviews only when empty
  // so existing users/bookings/conversations stay intact.
  if (normalized.reviews.length === 0) {
    normalized.reviews = clone(createSeedDb().reviews);
  }

  return normalized;
};

const notifyMockAuthChanged = () => {
  if (!isClient()) return;

  window.dispatchEvent(new Event(MOCK_AUTH_EVENT));
};

export const getMockDb = (): MockDb => {
  const stored = readStorage<MockDb>(DB_STORAGE_KEY);
  if (stored) {
    memoryDb = normalizeMockDb(clone(stored));
    writeStorage(DB_STORAGE_KEY, memoryDb);
    return clone(memoryDb);
  }

  if (!memoryDb) {
    memoryDb = createSeedDb();
  }

  writeStorage(DB_STORAGE_KEY, memoryDb);
  return clone(memoryDb);
};

const saveMockDb = (db: MockDb) => {
  memoryDb = clone(db);
  writeStorage(DB_STORAGE_KEY, memoryDb);
};

const updateMockDb = <T,>(updater: (db: MockDb) => T): T => {
  const db = getMockDb();
  const result = updater(db);
  saveMockDb(db);
  return result;
};

export const getMockSession = (): MockSession => {
  const stored = readStorage<MockSession>(SESSION_STORAGE_KEY);
  if (stored) {
    memorySession = stored;
    return stored;
  }

  if (!memorySession) {
    memorySession = createDefaultSession();
  }

  writeStorage(SESSION_STORAGE_KEY, memorySession);
  return memorySession;
};

const saveMockSession = (session: MockSession) => {
  memorySession = session;
  writeStorage(SESSION_STORAGE_KEY, session);
};

export const isMockUserLoggedIn = () => getMockSession().loggedIn;

export const signInMockUser = (email?: string) => {
  updateMockDb((db) => {
    const user = db.users[ACTIVE_USER_ID];
    if (email) {
      user.email = email;
    }
  });

  saveMockSession({
    loggedIn: true,
    uid: ACTIVE_USER_ID,
  });
  notifyMockAuthChanged();
};

export const signOutMockUser = () => {
  saveMockSession({
    loggedIn: false,
    uid: ACTIVE_USER_ID,
  });
  notifyMockAuthChanged();
};

export const getActiveMockProfile = () => {
  const session = getMockSession();
  if (!session.loggedIn) return null;

  return getMockDb().users[session.uid] || null;
};

export const getMockProfile = (uid: string) => getMockDb().users[uid] || null;

export const updateMockProfile = (
  uid: string,
  updates: Partial<MockUserProfile>
) => {
  updateMockDb((db) => {
    db.users[uid] = {
      ...db.users[uid],
      ...updates,
    };
  });

  return getMockProfile(uid);
};

export const setMockUserRole = (uid: string, isOwner: boolean) => {
  updateMockProfile(uid, { isOwner });
};

export const getMockAuthUser = (): User | null => {
  const profile = getActiveMockProfile();
  if (!profile) return null;

  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.profileImageUrl || null,
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    providerId: "mock",
    refreshToken: "mock-refresh-token",
    tenantId: null,
    delete: async () => undefined,
    getIdToken: async () => "mock-id-token",
    getIdTokenResult: async () =>
      ({
        token: "mock-id-token",
        expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        authTime: new Date().toISOString(),
        issuedAtTime: new Date().toISOString(),
        signInProvider: "mock",
        signInSecondFactor: null,
        claims: {},
      }) as any,
    reload: async () => undefined,
    toJSON: () => profile,
    metadata: {} as any,
  } as unknown as User;
};

export const getMockCourts = () => getMockDb().courts ?? [];

export const getMockCourtById = (id: string) =>
  getMockDb().courts.find((court) => court.id === id) || null;

export const addMockCourt = async (
  court: Omit<MockCourt, "id">
): Promise<MockCourt> => {
  const newCourt = {
    ...court,
    id: `mock-court-${Date.now()}`,
  };

  updateMockDb((db) => {
    db.courts.unshift(newCourt);
  });

  return newCourt;
};

export const updateMockCourt = async (
  courtId: string,
  updates: Partial<MockCourt>
) => {
  updateMockDb((db) => {
    db.courts = db.courts.map((court) =>
      court.id === courtId ? { ...court, ...updates } : court
    );
  });

  return getMockCourtById(courtId);
};

export const deleteMockCourt = async (courtId: string) => {
  updateMockDb((db) => {
    db.courts = db.courts.filter((court) => court.id !== courtId);
    db.bookings = db.bookings.filter((booking) => booking.courtId !== courtId);
  });
};

export const getMockBookings = () => getMockDb().bookings ?? [];

export const getMockBookingsForUser = (uid: string) =>
  getMockBookings().filter((booking) => booking.userId === uid);

export const getMockBookingsForOwner = (ownerId: string) => {
  const ownedCourtIds = new Set(
    getMockCourts()
      .filter((court) => court.ownerId === ownerId)
      .map((court) => court.id)
  );

  return getMockBookings().filter((booking) => ownedCourtIds.has(booking.courtId));
};

export const getMockBookingsForCourtAndDate = (courtId: string, date: string) =>
  getMockBookings().filter(
    (booking) => booking.courtId === courtId && booking.date === date
  );

export const getMockBookingById = (bookingId: string) =>
  getMockBookings().find((booking) => booking.id === bookingId) || null;

export const createMockBookingRequestConversation = (
  booking: MockBooking
) => {
  const conversationId = `booking_${booking.id}`;

  updateMockDb((db) => {
	    const { conversation, message, initialMessage } = buildMockConversationForBooking(
	      db,
	      booking
	    );
    const existingConversation = db.conversations.find(
      (item) => item.id === conversationId
    );

    db.conversations = existingConversation
      ? db.conversations.map((item) =>
          item.id === conversationId ? conversation : item
        )
      : [conversation, ...db.conversations];

	    db.messages = [
	      message,
	      ...(initialMessage ? [initialMessage] : []),
	      ...db.messages.filter(
	        (item) =>
	          !(
	            item.conversationId === conversationId &&
	            (item.id === "booking_request" || item.id === "initial_message")
	          )
	      ),
	    ];

    db.bookings = db.bookings.map((item) =>
      item.id === booking.id ? { ...item, conversationId } : item
    );
  });

  return conversationId;
};

export const getMockConversationsForUser = (uid: string) =>
  getMockDb()
    .conversations.filter((conversation) =>
      conversation.participantIds.includes(uid)
    )
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime()
    );

export const getMockMessagesForConversation = (conversationId: string) =>
  getMockDb()
    .messages.filter((message) => message.conversationId === conversationId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

export const markMockConversationRead = (
  conversationId: string,
  userId: string
) => {
  updateMockDb((db) => {
    db.conversations = db.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            unreadBy: conversation.unreadBy.filter(
              (participantId) => participantId !== userId
            ),
          }
        : conversation
    );
  });
};

export const createMockMessage = async (
  conversationId: string,
  senderId: string,
  body: string,
  options: Partial<
    Pick<
      MockMessage,
      "type" | "bookingId" | "courtId" | "status" | "declineReason" | "paymentStatus"
    >
  > = {}
) => {
  const now = new Date().toISOString();
  const message: MockMessage = {
    id: `mock-message-${Date.now()}`,
    conversationId,
    senderId,
    body,
    createdAt: now,
    type: options.type || "text",
    ...(options.bookingId ? { bookingId: options.bookingId } : {}),
    ...(options.courtId ? { courtId: options.courtId } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(options.declineReason ? { declineReason: options.declineReason } : {}),
    ...(options.paymentStatus ? { paymentStatus: options.paymentStatus } : {}),
  };

  updateMockDb((db) => {
    db.messages.push(message);
    db.conversations = db.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            lastMessageText: body,
            lastMessageAt: now,
            lastMessageSenderId: senderId,
            unreadBy: conversation.participantIds.filter(
              (participantId) => participantId !== senderId
            ),
            updatedAt: now,
          }
        : conversation
    );
  });

  return message;
};

export const createMockBooking = async (
  booking: Omit<
    MockBooking,
    "id" | "createdAt" | "sessionId" | "conversationId"
  >
) => {
  const newBooking: MockBooking = {
    ...booking,
    id: `mock-booking-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sessionId: `mock-session-${Date.now()}`,
  };

  updateMockDb((db) => {
    db.bookings.unshift(newBooking);
  });

  const conversationId = createMockBookingRequestConversation(newBooking);

  return {
    ...newBooking,
    conversationId,
  };
};

export const updateMockBooking = async (
  bookingId: string,
  updates: Partial<MockBooking>
) => {
  updateMockDb((db) => {
    db.bookings = db.bookings.map((booking) =>
      booking.id === bookingId ? { ...booking, ...updates } : booking
    );
  });

  return getMockBookingById(bookingId);
};

const getUpdatedAverage = (
  currentRating: number | undefined,
  currentCount: number | undefined,
  newRating: number
) => {
  const rating = currentRating || 0;
  const count = currentCount || 0;
  const nextCount = count + 1;
  const nextRating = (rating * count + newRating) / nextCount;

  return {
    rating: Math.round(nextRating * 10) / 10,
    count: nextCount,
  };
};

export const getMockReviewsForUser = (reviewerId: string) =>
  (getMockDb().reviews ?? []).filter((review) => review.reviewerId === reviewerId);

export const getMockReviewsForTarget = (revieweeId: string) =>
  (getMockDb().reviews ?? []).filter((review) => review.revieweeId === revieweeId);

export const getMockReviewsForCourt = (courtId: string) =>
  (getMockDb().reviews ?? []).filter(
    (review) => review.courtId === courtId && review.targetType === "court_owner"
  );

export const createMockReview = async ({
  bookingId,
  reviewerId,
  rating,
  comment,
}: {
  bookingId: string;
  reviewerId: string;
  rating: number;
  comment: string;
}) => {
  let createdReview: MockReview | null = null;

  updateMockDb((db) => {
    const booking = db.bookings.find((item) => item.id === bookingId);
    if (!booking) throw new Error("Booking not found");

    const court = db.courts.find((item) => item.id === booking.courtId);
    if (!court) throw new Error("Court for this booking was not found");

    const reviewerRole =
      reviewerId === booking.userId
        ? "player"
        : reviewerId === court.ownerId
          ? "owner"
          : null;

    if (!reviewerRole) {
      throw new Error("Only booking participants can review this booking");
    }

    const reviewId = `${bookingId}_${reviewerRole}`;
    if (db.reviews.some((review) => review.id === reviewId)) {
      throw new Error("You already reviewed this booking");
    }

    const now = new Date().toISOString();
    createdReview = {
      id: reviewId,
      bookingId,
      courtId: booking.courtId,
      playerId: booking.userId,
      ownerId: court.ownerId,
      reviewerId,
      reviewerRole,
      revieweeId: reviewerRole === "player" ? court.ownerId : booking.userId,
      targetType: reviewerRole === "player" ? "court_owner" : "player",
      rating,
      comment: comment.trim().slice(0, 1000),
      createdAt: now,
      updatedAt: now,
    };

    db.reviews.push(createdReview);

    if (reviewerRole === "player") {
      const courtAverage = getUpdatedAverage(
        court.rating,
        court.reviewCount,
        rating
      );
      db.courts = db.courts.map((item) =>
        item.id === court.id
          ? {
              ...item,
              rating: courtAverage.rating,
              reviewCount: courtAverage.count,
            }
          : item
      );

      const owner = db.users[court.ownerId];
      if (owner) {
        const ownerAverage = getUpdatedAverage(
          owner.ownerRating,
          owner.ownerReviewCount,
          rating
        );
        db.users[court.ownerId] = {
          ...owner,
          ownerRating: ownerAverage.rating,
          ownerReviewCount: ownerAverage.count,
        };
      }
    } else {
      const player = db.users[booking.userId];
      if (player) {
        const playerAverage = getUpdatedAverage(
          player.playerRating,
          player.playerReviewCount,
          rating
        );
        db.users[booking.userId] = {
          ...player,
          playerRating: playerAverage.rating,
          playerReviewCount: playerAverage.count,
        };
      }
    }
  });

  return createdReview;
};

export const getMockUserDisplayName = (uid: string) => {
  const user = getMockProfile(uid);
  return user?.displayName || user?.email || uid;
};

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export const subscribeToMockAuthChanges = (callback: () => void) => {
  if (!isClient()) {
    return () => undefined;
  }

  window.addEventListener(MOCK_AUTH_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(MOCK_AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};
