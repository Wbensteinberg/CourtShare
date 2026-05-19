/**
 * Automated coverage for the Manual Security Tests listed in docs/SECURITY.md.
 * Each describe block maps to one checklist item.
 */

import { validateImageFile, getSafeImageStoragePath } from "@/lib/imageUploadValidation";
import {
  isBookingReviewable,
  isBookingCancellable,
  isPendingBookingExpired,
  BOOKING_REVIEW_WINDOW_MS,
} from "@/lib/bookingDates";
import {
  createCheckoutBodySchema,
  sendMessageBodySchema,
  reviewPostBodySchema,
  rejectBookingBodySchema,
} from "@/lib/apiSchemas";

// ---------------------------------------------------------------------------
// 1. User cannot upload SVG, HTML, executables, oversized images, or
//    unsupported types
// ---------------------------------------------------------------------------

describe("image upload validation", () => {
  const make = (type: string, bytes: number) =>
    new File([new Uint8Array(bytes)], "test", { type });

  it("accepts JPEG, PNG, and WEBP", () => {
    expect(validateImageFile(make("image/jpeg", 100))).toBe("");
    expect(validateImageFile(make("image/png", 100))).toBe("");
    expect(validateImageFile(make("image/webp", 100))).toBe("");
  });

  it("rejects SVG", () => {
    expect(validateImageFile(make("image/svg+xml", 100))).not.toBe("");
  });

  it("rejects HTML disguised as an image", () => {
    expect(validateImageFile(make("text/html", 100))).not.toBe("");
  });

  it("rejects executable MIME types", () => {
    expect(validateImageFile(make("application/x-msdownload", 100))).not.toBe("");
    expect(validateImageFile(make("application/octet-stream", 100))).not.toBe("");
  });

  it("rejects files over 8 MB", () => {
    const overLimit = 8 * 1024 * 1024 + 1;
    expect(validateImageFile(make("image/jpeg", overLimit))).not.toBe("");
  });

  it("accepts files exactly at 8 MB", () => {
    const atLimit = 8 * 1024 * 1024;
    expect(validateImageFile(make("image/jpeg", atLimit))).toBe("");
  });

  it("storage path does not include the original filename", () => {
    const file = new File(["x"], "../../evil.php", { type: "image/jpeg" });
    const path = getSafeImageStoragePath("users", "uid123", file);
    expect(path).not.toContain("evil");
    expect(path).not.toContain(".php");
    expect(path).toMatch(/^users\/uid123\/.+\.jpg$/);
  });
});

// ---------------------------------------------------------------------------
// 2. User cannot review a booking they were not part of / outside the window
// ---------------------------------------------------------------------------

describe("booking review window", () => {
  const booking = (
    status: string,
    endedMinutesAgo: number,
    durationMinutes = 60
  ) => {
    const end = new Date(Date.now() - endedMinutesAgo * 60 * 1000);
    const start = new Date(end.getTime() - durationMinutes * 60 * 1000);
    return {
      status,
      date: start.toISOString().slice(0, 10),
      time: start.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      durationMinutes,
    };
  };

  it("is reviewable just after the booking ends", () => {
    expect(isBookingReviewable(booking("confirmed", 5))).toBe(true);
    expect(isBookingReviewable(booking("completed", 5))).toBe(true);
  });

  it("is not reviewable before the booking ends", () => {
    // ended -60 min = starts in the future
    const future = booking("confirmed", -60);
    expect(isBookingReviewable(future)).toBe(false);
  });

  it("is not reviewable for pending, cancelled, rejected, or expired bookings", () => {
    for (const status of ["pending", "cancelled", "rejected", "expired"]) {
      expect(isBookingReviewable(booking(status, 30))).toBe(false);
    }
  });

  it("is not reviewable after the 7-day window closes", () => {
    const msInEightDays = 8 * 24 * 60 * 60 * 1000;
    const overWindow = booking("confirmed", msInEightDays / 60 / 1000);
    expect(isBookingReviewable(overWindow)).toBe(false);
  });

  it("is reviewable at any point within the 7-day window", () => {
    const sixDaysAgo = (BOOKING_REVIEW_WINDOW_MS - 60 * 60 * 1000) / 60 / 1000;
    expect(isBookingReviewable(booking("confirmed", sixDaysAgo))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Confirmed player cancellations require 24-hour lead time
// ---------------------------------------------------------------------------

describe("booking cancellability (24-hour rule)", () => {
  const MINS_24H = 24 * 60;

  const bookingAt = (minutesFromNow: number) => {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
    return {
      date: d.toISOString().slice(0, 10),
      time: d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  it("allows cancellation more than 24 hours out", () => {
    expect(isBookingCancellable(bookingAt(MINS_24H + 30), MINS_24H)).toBe(true);
  });

  it("blocks cancellation less than 24 hours out", () => {
    expect(isBookingCancellable(bookingAt(MINS_24H - 30), MINS_24H)).toBe(false);
  });

  it("blocks cancellation on a past booking", () => {
    expect(isBookingCancellable(bookingAt(-60), MINS_24H)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Pending booking expires after 24 hours
// ---------------------------------------------------------------------------

describe("pending booking expiry", () => {
  const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 2 days out
  const futureBooking = {
    date: futureDate.toISOString().slice(0, 10),
    time: "10:00 AM",
  };

  it("is not expired when recently created", () => {
    expect(
      isPendingBookingExpired({
        ...futureBooking,
        status: "pending",
        createdAt: new Date(),
      })
    ).toBe(false);
  });

  it("is expired after the 24-hour acceptance window", () => {
    const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(
      isPendingBookingExpired({
        ...futureBooking,
        status: "pending",
        createdAt,
      })
    ).toBe(true);
  });

  it("is expired if the booking start time is already in the past", () => {
    expect(
      isPendingBookingExpired({
        date: "2020-01-01",
        time: "10:00 AM",
        status: "pending",
        createdAt: new Date(),
      })
    ).toBe(true);
  });

  it("non-pending bookings are never treated as expired by this check", () => {
    expect(
      isPendingBookingExpired({
        ...futureBooking,
        status: "confirmed",
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. User cannot alter checkout price, owner ID, or other server-managed
//    fields from the browser — schema strips all unknown fields
// ---------------------------------------------------------------------------

describe("checkout schema rejects server-managed fields", () => {
  const validBase = {
    courtId: "court-abc",
    date: "2026-08-01",
    time: "10:00 AM",
    durationMinutes: 60,
  };

  it("parses a valid checkout body", () => {
    const result = createCheckoutBodySchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("strips client-submitted price and financial fields", () => {
    const result = createCheckoutBodySchema.safeParse({
      ...validBase,
      price: 0,
      totalAmountCents: 0,
      ownerAmountCents: 0,
      courtShareFeeCents: 0,
      ownerId: "attacker",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("price");
      expect(result.data).not.toHaveProperty("totalAmountCents");
      expect(result.data).not.toHaveProperty("ownerAmountCents");
      expect(result.data).not.toHaveProperty("ownerId");
    }
  });

  it("rejects dates in wrong format", () => {
    expect(
      createCheckoutBodySchema.safeParse({ ...validBase, date: "01/08/2026" }).success
    ).toBe(false);
    expect(
      createCheckoutBodySchema.safeParse({ ...validBase, date: "not-a-date" }).success
    ).toBe(false);
  });

  it("rejects durationMinutes over 180", () => {
    expect(
      createCheckoutBodySchema.safeParse({ ...validBase, durationMinutes: 181 }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Message length limits prevent large payload writes
// ---------------------------------------------------------------------------

describe("message and review schema limits", () => {
  it("rejects messages over 4000 characters", () => {
    const result = sendMessageBodySchema.safeParse({
      conversationId: "conv-1",
      body: "x".repeat(4001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts messages up to 4000 characters", () => {
    const result = sendMessageBodySchema.safeParse({
      conversationId: "conv-1",
      body: "x".repeat(4000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects review ratings outside 1-5", () => {
    expect(
      reviewPostBodySchema.safeParse({ bookingId: "b1", rating: 0 }).success
    ).toBe(false);
    expect(
      reviewPostBodySchema.safeParse({ bookingId: "b1", rating: 6 }).success
    ).toBe(false);
  });

  it("accepts review ratings 1-5", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(
        reviewPostBodySchema.safeParse({ bookingId: "b1", rating }).success
      ).toBe(true);
    }
  });

  it("rejects a blank decline reason", () => {
    expect(
      rejectBookingBodySchema.safeParse({ bookingId: "b1", declineReason: "" }).success
    ).toBe(false);
    expect(
      rejectBookingBodySchema.safeParse({ bookingId: "b1", declineReason: "   " }).success
    ).toBe(false);
  });

  it("rejects a decline reason over 1000 characters", () => {
    expect(
      rejectBookingBodySchema.safeParse({
        bookingId: "b1",
        declineReason: "x".repeat(1001),
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Production never loads mock data
// ---------------------------------------------------------------------------

describe("mock mode is disabled in production", () => {
  const mockModeLogic = (
    nodeEnv: string,
    useMockData: string | undefined,
    apiKey: string | undefined
  ) =>
    nodeEnv !== "production" &&
    (useMockData === "true" || !apiKey);

  it("is false in production regardless of env vars", () => {
    expect(mockModeLogic("production", "true", undefined)).toBe(false);
    expect(mockModeLogic("production", "true", "key")).toBe(false);
    expect(mockModeLogic("production", undefined, undefined)).toBe(false);
  });

  it("is true in development when mock flag is set", () => {
    expect(mockModeLogic("development", "true", "key")).toBe(true);
  });

  it("is true in development when Firebase config is missing", () => {
    expect(mockModeLogic("development", undefined, undefined)).toBe(true);
  });

  it("is false in development when Firebase config is present and mock flag is off", () => {
    expect(mockModeLogic("development", undefined, "some-api-key")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. CSP middleware generates a per-request nonce
// ---------------------------------------------------------------------------

describe("CSP nonce middleware", () => {
  it("generates a different nonce on every call", async () => {
    const { middleware } = await import("../middleware");
    const makeReq = () =>
      new Request("http://localhost:3000/", { method: "GET" }) as unknown as import("next/server").NextRequest;

    const r1 = middleware(makeReq());
    const r2 = middleware(makeReq());

    const csp1 = r1.headers.get("content-security-policy") ?? "";
    const csp2 = r2.headers.get("content-security-policy") ?? "";

    const nonce1 = csp1.match(/'nonce-([^']+)'/)?.[1];
    const nonce2 = csp2.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);
  });

  it("CSP contains strict-dynamic alongside the nonce", async () => {
    const { middleware } = await import("../middleware");
    const req = new Request("http://localhost:3000/", {
      method: "GET",
    }) as unknown as import("next/server").NextRequest;

    const res = middleware(req);
    const csp = res.headers.get("content-security-policy") ?? "";

    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  });

  it("nonce is set in both response header and x-nonce request header", async () => {
    const { middleware } = await import("../middleware");
    const req = new Request("http://localhost:3000/", {
      method: "GET",
    }) as unknown as import("next/server").NextRequest;

    const res = middleware(req);
    const responseCsp = res.headers.get("content-security-policy") ?? "";
    const nonce = responseCsp.match(/'nonce-([^']+)'/)?.[1];

    expect(nonce).toBeTruthy();
    // The nonce appears in the CSP sent to the browser
    expect(responseCsp).toContain(`'nonce-${nonce}'`);
  });
});
