import { NextRequest } from "next/server";
import { Response as UndiciResponse } from "undici";
import {
  mockReviewsGET,
  mockReviewsPOST,
  resetMockApiServerState,
} from "@/lib/mockApiServer";
import { MOCK_FIREBASE_ID_TOKEN } from "@/lib/mockApiAuth";

const authHeader = { Authorization: `Bearer ${MOCK_FIREBASE_ID_TOKEN}` };

describe("mockApiServer", () => {
  beforeAll(() => {
    process.env.MOCK_API = "true";
    process.env.NEXT_PUBLIC_USE_MOCK_DATA = "true";
  });

  it("smoke: undici Response JSON roundtrip", async () => {
    const r = new UndiciResponse(JSON.stringify({ hello: "world" }), {
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(await r.text()).hello).toBe("world");
  });

  beforeEach(() => {
    resetMockApiServerState();
  });

  it("GET reviews by courtId returns 200", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/reviews?courtId=mock-court-1"
    );
    const res = await mockReviewsGET(req);
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());
    expect(Array.isArray(data.reviews)).toBe(true);
  });

  it("POST review for completed booking succeeds for player", async () => {
    const req = new NextRequest("http://localhost:3000/api/reviews", {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: "mock-booking-open-review",
        rating: 5,
        comment: "Great session",
      }),
    });
    const res = await mockReviewsPOST(req);
    expect(res.status).toBe(200);
    const data = JSON.parse(await res.text());
    expect(data.success).toBe(true);

    const getReq = new NextRequest(
      "http://localhost:3000/api/reviews?targetUserId=mock-user-2"
    );
    const getRes = await mockReviewsGET(getReq);
    const list = JSON.parse(await getRes.text());
    expect(list.reviews.length).toBeGreaterThanOrEqual(1);
  });
});
