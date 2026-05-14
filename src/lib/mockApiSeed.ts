import { theme } from "@/lib/theme";

export const MOCK_ACTIVE_USER_ID = "mock-user-1";

export type MockApiUserRow = {
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
  createdAt?: string;
};

export type MockApiCourtRow = {
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
  maxGuests?: number | null;
};

export type MockApiBookingRow = {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  durationMinutes?: number;
  status: string;
  cancelReason?: string;
  declineReason?: string;
  courtNumber?: number;
  guestCount?: number;
  initialMessage?: string;
  createdAt?: string;
  expiresAt?: string;
  sessionId?: string;
  paymentIntentId?: string | null;
  paymentStatus?: string;
  totalAmountCents?: number;
  conversationId?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
};

export type MockApiReviewRow = {
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

export type MockApiData = {
  users: Record<string, MockApiUserRow>;
  courts: MockApiCourtRow[];
  bookings: MockApiBookingRow[];
  reviews: MockApiReviewRow[];
};

const formatDateOffset = (daysFromToday: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
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
      <text x="96" y="110" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700">CourtShare Demo</text>
      <text x="96" y="710" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800">${title}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const mockMemberSinceMonthsAgo = (monthsAgo: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString();
};

const expiresIn24h = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const seedIsoDaysAgo = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

/** Deep-cloneable seed for the server mock API store (aligned with client mockData). */
export const createMockApiSeedData = (): MockApiData => {
  const activeUser: MockApiUserRow = {
    uid: MOCK_ACTIVE_USER_ID,
    email: "demo@courtshare.co",
    displayName: "Riley Chen",
    bio: "League player, early-morning hitter, and part-time court host.",
    profileImageUrl: "",
    isOwner: false,
    createdAt: mockMemberSinceMonthsAgo(10),
  };

  const guestUser: MockApiUserRow = {
    uid: "mock-user-2",
    email: "jamie@courtshare.co",
    displayName: "Jamie Brooks",
    bio: "Weekend doubles player.",
    profileImageUrl: "",
    isOwner: false,
    createdAt: mockMemberSinceMonthsAgo(14),
  };

  const guestUserTwo: MockApiUserRow = {
    uid: "mock-user-3",
    email: "taylor@courtshare.co",
    displayName: "Taylor Morgan",
    bio: "Competitive USTA player.",
    profileImageUrl: "",
    isOwner: false,
    createdAt: mockMemberSinceMonthsAgo(5),
  };

  const courts: MockApiCourtRow[] = [
    {
      id: "mock-court-1",
      name: "Sunset Baseline Club",
      location: "Santa Monica, CA",
      address: "1432 Ocean Park Blvd, Santa Monica, CA",
      accessInstructions: "Check in with the front desk and use court gate code 4411.",
      price: 48,
      description:
        "Bright outdoor hard courts with shade seating, water refill, and quick freeway access.",
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
      description:
        "Clean public-private hybrid facility with easy parking and a steady after-work crowd.",
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
      description:
        "Premium private courts with lounge seating, string lights, and polished owner-side amenities.",
      imageUrl: createImageDataUrl("Match Point Courts", "#f59e0b"),
      imageUrls: [createImageDataUrl("Match Point Courts", "#f59e0b")],
      ownerId: MOCK_ACTIVE_USER_ID,
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

  const bookings: MockApiBookingRow[] = [
    {
      id: "mock-booking-1",
      courtId: "mock-court-1",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(2),
      time: "7:00 PM",
      duration: 2,
      durationMinutes: 120,
      status: "confirmed",
      courtNumber: 1,
      createdAt: nowIso,
      sessionId: "mock-session-1",
      paymentStatus: "captured",
    },
    {
      id: "mock-booking-2",
      courtId: "mock-court-2",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(5),
      time: "8:00 AM",
      duration: 1,
      durationMinutes: 60,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      expiresAt: expiresIn24h(),
      sessionId: "mock-session-2",
      paymentStatus: "authorized",
    },
    {
      id: "mock-booking-3",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(3),
      time: "5:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      expiresAt: expiresIn24h(),
      sessionId: "mock-session-3",
      paymentStatus: "authorized",
    },
    {
      id: "mock-booking-4",
      courtId: "mock-court-3",
      userId: "mock-user-3",
      date: formatDateOffset(-2),
      time: "10:00 AM",
      duration: 2,
      durationMinutes: 120,
      status: "completed",
      courtNumber: 2,
      createdAt: seedIsoDaysAgo(4),
      sessionId: "mock-session-4",
      paymentStatus: "captured",
    },
    {
      id: "mock-seed-p1",
      courtId: "mock-court-1",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-14),
      time: "10:00 AM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(15),
      sessionId: "mock-session-p1",
      paymentStatus: "captured",
    },
    {
      id: "mock-seed-p2",
      courtId: "mock-court-2",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-21),
      time: "4:00 PM",
      duration: 2,
      durationMinutes: 120,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(22),
      sessionId: "mock-session-p2",
      paymentStatus: "captured",
    },
    {
      id: "mock-seed-p3",
      courtId: "mock-court-1",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-35),
      time: "9:00 AM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 2,
      createdAt: seedIsoDaysAgo(36),
      sessionId: "mock-session-p3",
      paymentStatus: "captured",
    },
    {
      id: "mock-seed-p4",
      courtId: "mock-court-2",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-7),
      time: "11:00 AM",
      duration: 1,
      durationMinutes: 60,
      status: "cancelled",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(9),
      sessionId: "mock-session-p4",
      paymentStatus: "authorized",
      cancelledAt: seedIsoDaysAgo(8),
    },
    {
      id: "mock-seed-p5",
      courtId: "mock-court-1",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-10),
      time: "2:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "rejected",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(11),
      sessionId: "mock-session-p5",
      paymentStatus: "authorized",
      rejectedAt: seedIsoDaysAgo(10),
    },
    {
      id: "mock-seed-p6",
      courtId: "mock-court-2",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-45),
      time: "8:00 AM",
      duration: 1,
      durationMinutes: 60,
      status: "expired",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(50),
      sessionId: "mock-session-p6",
      paymentStatus: "authorized",
      expiredAt: seedIsoDaysAgo(46),
    },
    {
      id: "mock-seed-p7",
      courtId: "mock-court-1",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(10),
      time: "6:30 PM",
      duration: 1,
      durationMinutes: 60,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      expiresAt: expiresIn24h(),
      sessionId: "mock-session-p7",
      paymentStatus: "authorized",
    },
    {
      id: "mock-seed-p8",
      courtId: "mock-court-1",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-8),
      time: "1:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(9),
      sessionId: "mock-session-p8",
      paymentStatus: "captured",
    },
    {
      id: "mock-seed-p9",
      courtId: "mock-court-2",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-3),
      time: "3:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(4),
      sessionId: "mock-session-p9",
      paymentStatus: "captured",
    },
    {
      id: "mock-host-past1",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(-30),
      time: "3:00 PM",
      duration: 2,
      durationMinutes: 120,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(31),
      sessionId: "mock-session-hp1",
      paymentStatus: "captured",
    },
    {
      id: "mock-host-past2",
      courtId: "mock-court-3",
      userId: "mock-user-3",
      date: formatDateOffset(-18),
      time: "1:00 PM",
      duration: 2,
      durationMinutes: 120,
      status: "completed",
      courtNumber: 2,
      createdAt: seedIsoDaysAgo(19),
      sessionId: "mock-session-hp2",
      paymentStatus: "captured",
    },
    {
      id: "mock-host-past3",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(-5),
      time: "7:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(6),
      sessionId: "mock-session-hp3",
      paymentStatus: "captured",
    },
    {
      id: "mock-host-req2",
      courtId: "mock-court-3",
      userId: "mock-user-3",
      date: formatDateOffset(7),
      time: "9:00 AM",
      duration: 1,
      durationMinutes: 60,
      status: "pending",
      courtNumber: 1,
      createdAt: nowIso,
      expiresAt: expiresIn24h(),
      sessionId: "mock-session-hr2",
      paymentStatus: "authorized",
    },
    {
      id: "mock-host-req3",
      courtId: "mock-court-3",
      userId: "mock-user-2",
      date: formatDateOffset(12),
      time: "4:00 PM",
      duration: 2,
      durationMinutes: 120,
      status: "pending",
      courtNumber: 2,
      createdAt: nowIso,
      expiresAt: expiresIn24h(),
      sessionId: "mock-session-hr3",
      paymentStatus: "authorized",
    },
    {
      id: "mock-seed-j1",
      courtId: "mock-court-1",
      userId: "mock-user-3",
      date: formatDateOffset(-11),
      time: "5:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(12),
      sessionId: "mock-session-j1",
      paymentStatus: "captured",
    },
    {
      id: "mock-seed-t1",
      courtId: "mock-court-2",
      userId: "mock-user-2",
      date: formatDateOffset(-12),
      time: "10:00 AM",
      duration: 2,
      durationMinutes: 120,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(13),
      sessionId: "mock-session-t1",
      paymentStatus: "captured",
    },
    {
      id: "mock-seed-t2",
      courtId: "mock-court-2",
      userId: "mock-user-2",
      date: formatDateOffset(-20),
      time: "2:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(21),
      sessionId: "mock-session-t2",
      paymentStatus: "captured",
    },
    {
      id: "mock-booking-open-review",
      courtId: "mock-court-1",
      userId: MOCK_ACTIVE_USER_ID,
      date: formatDateOffset(-1),
      time: "6:00 PM",
      duration: 1,
      durationMinutes: 60,
      status: "completed",
      courtNumber: 1,
      createdAt: seedIsoDaysAgo(2),
      sessionId: "mock-session-open-review",
      paymentStatus: "captured",
    },
  ];

  const reviews: MockApiReviewRow[] = [
    {
      id: "mock-seed-p1_player",
      bookingId: "mock-seed-p1",
      courtId: "mock-court-1",
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: "mock-user-2",
      reviewerRole: "owner",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: "mock-user-3",
      reviewerRole: "owner",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: "mock-user-2",
      reviewerRole: "owner",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-2",
      reviewerId: "mock-user-2",
      reviewerRole: "owner",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      playerId: MOCK_ACTIVE_USER_ID,
      ownerId: "mock-user-3",
      reviewerId: "mock-user-3",
      reviewerRole: "owner",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: "mock-user-2",
      reviewerRole: "player",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: "mock-user-3",
      reviewerRole: "player",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: "mock-user-2",
      reviewerRole: "player",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: "mock-user-3",
      reviewerRole: "player",
      revieweeId: MOCK_ACTIVE_USER_ID,
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
      ownerId: MOCK_ACTIVE_USER_ID,
      reviewerId: MOCK_ACTIVE_USER_ID,
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

  bookings.forEach((b) => {
    if (!b.conversationId) {
      b.conversationId = `booking_${b.id}`;
    }
  });

  return {
    users: {
      [activeUser.uid]: activeUser,
      [guestUser.uid]: guestUser,
      [guestUserTwo.uid]: guestUserTwo,
    },
    courts,
    bookings,
    reviews,
  };
};
