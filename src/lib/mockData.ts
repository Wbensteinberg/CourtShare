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
  courtNumber?: number;
  createdAt?: string;
  sessionId?: string;
};

type MockDb = {
  users: Record<string, MockUserProfile>;
  courts: MockCourt[];
  bookings: MockBooking[];
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

const createSeedDb = (): MockDb => {
  const activeUser: MockUserProfile = {
    uid: ACTIVE_USER_ID,
    email: "demo@courtshare.co",
    displayName: "Riley Chen",
    bio: "League player, early-morning hitter, and part-time court host.",
    profileImageUrl: "",
    isOwner: false,
  };

  const guestUser: MockUserProfile = {
    uid: "mock-user-2",
    email: "jamie@courtshare.co",
    displayName: "Jamie Brooks",
    bio: "Weekend doubles player.",
    profileImageUrl: "",
    isOwner: false,
  };

  const guestUserTwo: MockUserProfile = {
    uid: "mock-user-3",
    email: "taylor@courtshare.co",
    displayName: "Taylor Morgan",
    bio: "Competitive USTA player.",
    profileImageUrl: "",
    isOwner: false,
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
      reviewCount: 31,
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
      reviewCount: 19,
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
      rating: 5,
      reviewCount: 12,
    },
  ];

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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
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
      createdAt: new Date().toISOString(),
      sessionId: "mock-session-3",
    },
    {
      id: "mock-booking-4",
      courtId: "mock-court-3",
      userId: "mock-user-3",
      date: formatDateOffset(-2),
      time: "10:00 AM",
      duration: 2,
      status: "confirmed",
      courtNumber: 2,
      createdAt: new Date().toISOString(),
      sessionId: "mock-session-4",
    },
  ];

  return {
    users: {
      [activeUser.uid]: activeUser,
      [guestUser.uid]: guestUser,
      [guestUserTwo.uid]: guestUserTwo,
    },
    courts,
    bookings,
  };
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

const notifyMockAuthChanged = () => {
  if (!isClient()) return;

  window.dispatchEvent(new Event(MOCK_AUTH_EVENT));
};

export const getMockDb = (): MockDb => {
  const stored = readStorage<MockDb>(DB_STORAGE_KEY);
  if (stored) {
    memoryDb = clone(stored);
    return clone(stored);
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

export const getMockCourts = () => getMockDb().courts;

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

export const getMockBookings = () => getMockDb().bookings;

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

export const createMockBooking = async (
  booking: Omit<MockBooking, "id" | "createdAt" | "sessionId">
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

  return newBooking;
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
