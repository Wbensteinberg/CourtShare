import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isBookingReviewable } from "@/lib/bookingDates";
import { isMockApiMode } from "@/lib/mockApiMode";
import { mockReviewsGET, mockReviewsPOST } from "@/lib/mockApiServer";
import { shouldShowPublicReview } from "@/lib/reviewVisibility";
import { sendReviewNotificationEmail } from "@/lib/email";

const getAuthUserId = async (req: NextRequest) => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  if (!adminAuth) {
    throw new Error("Authentication service not initialized");
  }

  const idToken = authHeader.split("Bearer ")[1];
  const decodedToken = await adminAuth.verifyIdToken(idToken, true);
  return decodedToken.uid;
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

const serializeDate = (value: any) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
};

const toPublicReview = (reviewDoc: any) => {
  const review = reviewDoc.data();
  return {
    id: reviewDoc.id,
    bookingId: review.bookingId,
    courtId: review.courtId,
    reviewerId: review.reviewerId,
    playerId: review.playerId,
    reviewerRole: review.reviewerRole,
    targetType: review.targetType,
    rating: review.rating,
    comment: review.comment || "",
    createdAt: serializeDate(review.createdAt),
  };
};

export async function GET(req: NextRequest) {
  try {
    if (isMockApiMode()) {
      return mockReviewsGET(req);
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }
    const db = adminDb;

    const targetUserId = req.nextUrl.searchParams.get("targetUserId")?.trim();
    const courtId = req.nextUrl.searchParams.get("courtId")?.trim();

    if (targetUserId || courtId) {
      const reviewsSnap = targetUserId
        ? await db
            .collection("reviews")
            .where("revieweeId", "==", targetUserId)
            .get()
        : await db.collection("reviews").where("courtId", "==", courtId).get();

      const reviews = reviewsSnap.docs
        .map(toPublicReview)
        .filter((review) =>
          courtId ? review.targetType === "court_owner" : true
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );

      const pairedReviewChecks = await Promise.all(
        reviews.map(async (review) => {
          if (review.targetType === "player") {
            return true;
          }

          const otherRole = review.reviewerRole === "player" ? "owner" : "player";
          const pairedReviewId = `${review.bookingId}_${otherRole}`;
          const pairedReviewDoc = await db.collection("reviews").doc(pairedReviewId).get();
          return pairedReviewDoc.exists;
        })
      );
      const visibleReviews = reviews.filter((review, index) =>
        shouldShowPublicReview(review, pairedReviewChecks[index])
      );

      const reviewerIds = [
        ...new Set(
          visibleReviews
            .map((review) => review.reviewerId || review.playerId)
            .filter(Boolean)
        ),
      ];
      const reviewerProfiles = new Map<string, { displayName: string; profileImageUrl: string }>();
      await Promise.all(
        reviewerIds.map(async (reviewerId) => {
          const userDoc = await db.collection("users").doc(reviewerId).get();
          const userData = userDoc.exists ? userDoc.data() : null;
          reviewerProfiles.set(reviewerId, {
            displayName:
              typeof userData?.displayName === "string" && userData.displayName.trim()
                ? userData.displayName.trim()
                : "CourtShare player",
            profileImageUrl:
              typeof userData?.profileImageUrl === "string" ? userData.profileImageUrl : "",
          });
        })
      );

      return NextResponse.json({
        reviews: visibleReviews.map((review) => {
          const reviewer = reviewerProfiles.get(review.reviewerId || review.playerId);
          return {
            ...review,
            reviewerName: reviewer?.displayName || "CourtShare player",
            reviewerProfileImageUrl: reviewer?.profileImageUrl || "",
          };
        }),
      });
    }

    const reviewerId = await getAuthUserId(req);
    const bookingIds = new Set(
      (req.nextUrl.searchParams.get("bookingIds") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    );
    const withPairedStatus = req.nextUrl.searchParams.get("withPairedStatus") === "true";

    const reviewsSnap = await db
      .collection("reviews")
      .where("reviewerId", "==", reviewerId)
      .get();

    const reviews = reviewsSnap.docs
      .map((reviewDoc) => ({
        id: reviewDoc.id,
        ...reviewDoc.data(),
      }))
      .filter((review: any) =>
        bookingIds.size > 0 ? bookingIds.has(review.bookingId) : true
      )
      .map((review: any) => ({
        id: review.id,
        bookingId: review.bookingId,
        reviewerRole: review.reviewerRole,
        rating: review.rating,
      }));

    if (!withPairedStatus || bookingIds.size === 0) {
      return NextResponse.json({ reviews });
    }

    // For each requested bookingId, check whether the counterparty has reviewed.
    const counterpartyReviewedBookingIds: string[] = [];
    await Promise.all(
      Array.from(bookingIds).map(async (bookingId) => {
        try {
          const bookingDoc = await db.collection("bookings").doc(bookingId).get();
          if (!bookingDoc.exists) return;
          const bookingData = bookingDoc.data()!;

          const courtDoc = await db.collection("courts").doc(bookingData.courtId).get();
          const courtData = courtDoc.exists ? courtDoc.data() : null;

          const callerRole =
            bookingData.userId === reviewerId
              ? "player"
              : courtData?.ownerId === reviewerId
                ? "owner"
                : null;

          if (!callerRole) return;

          const counterpartyRole = callerRole === "player" ? "owner" : "player";
          const counterpartyReviewId = `${bookingId}_${counterpartyRole}`;
          const counterpartyReviewDoc = await db
            .collection("reviews")
            .doc(counterpartyReviewId)
            .get();

          if (counterpartyReviewDoc.exists) {
            counterpartyReviewedBookingIds.push(bookingId);
          }
        } catch {
          // Non-fatal — just omit this bookingId from the counterparty list.
        }
      })
    );

    return NextResponse.json({ reviews, counterpartyReviewedBookingIds });
  } catch (err: any) {
    const message = err.message || "Failed to load reviews";
    return NextResponse.json(
      { error: message },
      { status: message.includes("authorization") ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (isMockApiMode()) {
      return mockReviewsPOST(req);
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }
    const db = adminDb;

    const reviewerId = await getAuthUserId(req);
    const { bookingId, rating, comment } = await req.json();
    const normalizedRating = Number(rating);
    const normalizedComment =
      typeof comment === "string" ? comment.trim().slice(0, 1000) : "";

    if (!bookingId || !Number.isInteger(normalizedRating)) {
      return NextResponse.json(
        { error: "Booking ID and whole-star rating are required" },
        { status: 400 }
      );
    }

    if (normalizedRating < 1 || normalizedRating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5 stars" },
        { status: 400 }
      );
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingDoc.data()!;
    const courtRef = db.collection("courts").doc(booking.courtId);
    const courtDoc = await courtRef.get();
    const court = courtDoc.exists ? courtDoc.data() : null;

    if (!court) {
      return NextResponse.json(
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
      return NextResponse.json(
        { error: "Only booking participants can review this booking" },
        { status: 403 }
      );
    }

    if (!isBookingReviewable(booking as Parameters<typeof isBookingReviewable>[0])) {
      return NextResponse.json(
        { error: "Reviews are available for two months after a confirmed booking" },
        { status: 400 }
      );
    }

    const reviewId = `${bookingId}_${reviewerRole}`;
    const reviewRef = db.collection("reviews").doc(reviewId);
    const revieweeId = reviewerRole === "player" ? court.ownerId : booking.userId;

    await db.runTransaction(async (transaction) => {
      const existingReview = await transaction.get(reviewRef);
      if (existingReview.exists) {
        throw new Error("You already reviewed this booking");
      }
      const transactionCourtDoc = await transaction.get(courtRef);
      const transactionCourt = transactionCourtDoc.exists
        ? transactionCourtDoc.data()
        : court;

      const targetType = reviewerRole === "player" ? "court_owner" : "player";
      const aggregateUserRef = db
        .collection("users")
        .doc(reviewerRole === "player" ? court.ownerId : booking.userId);
      const aggregateUserDoc = await transaction.get(aggregateUserRef);
      const aggregateUser = aggregateUserDoc.exists
        ? aggregateUserDoc.data()
        : {};

      transaction.set(reviewRef, {
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (reviewerRole === "player") {
        const courtAverage = getUpdatedAverage(
          transactionCourt?.rating,
          transactionCourt?.reviewCount,
          normalizedRating
        );
        transaction.update(courtRef, {
          rating: courtAverage.rating,
          reviewCount: courtAverage.count,
          updatedAt: FieldValue.serverTimestamp(),
        });

        const ownerAverage = getUpdatedAverage(
          aggregateUser?.ownerRating,
          aggregateUser?.ownerReviewCount,
          normalizedRating
        );
        transaction.set(
          aggregateUserRef,
          {
            ownerRating: ownerAverage.rating,
            ownerReviewCount: ownerAverage.count,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        const playerAverage = getUpdatedAverage(
          aggregateUser?.playerRating,
          aggregateUser?.playerReviewCount,
          normalizedRating
        );
        transaction.set(
          aggregateUserRef,
          {
            playerRating: playerAverage.rating,
            playerReviewCount: playerAverage.count,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    });

    // Fire-and-forget review notification email to the reviewee.
    (async () => {
      try {
        const counterpartyRole = reviewerRole === "player" ? "owner" : "player";
        const recipientUid = revieweeId;

        const [recipientDoc, reviewerDoc] = await Promise.all([
          db.collection("users").doc(recipientUid).get(),
          db.collection("users").doc(reviewerId).get(),
        ]);
        const recipientData = recipientDoc.exists ? recipientDoc.data() : null;
        const reviewerData = reviewerDoc.exists ? reviewerDoc.data() : null;
        const recipientEmail = recipientData?.email;
        if (!recipientEmail) return;

        // Check if recipient has already submitted their own review.
        const recipientReviewId = `${bookingId}_${counterpartyRole}`;
        const recipientReviewDoc = await db.collection("reviews").doc(recipientReviewId).get();

        await sendReviewNotificationEmail({
          recipientEmail,
          recipientName: recipientData?.displayName || undefined,
          reviewerName: reviewerData?.displayName || undefined,
          courtName: court.name || "CourtShare court",
          bookingId,
          date: booking.date,
          recipientHasAlreadyReviewed: recipientReviewDoc.exists,
        });
      } catch {
        // Email failure must not affect the review response.
      }
    })();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const message = err.message || "Failed to submit review";
    const status = message.includes("already reviewed") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
