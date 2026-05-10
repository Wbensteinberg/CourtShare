import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isBookingReviewable } from "@/lib/bookingDates";

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
    reviewerRole: review.reviewerRole,
    targetType: review.targetType,
    rating: review.rating,
    comment: review.comment || "",
    createdAt: serializeDate(review.createdAt),
  };
};

export async function GET(req: NextRequest) {
  try {
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

      return NextResponse.json({ reviews });
    }

    const reviewerId = await getAuthUserId(req);
    const bookingIds = new Set(
      (req.nextUrl.searchParams.get("bookingIds") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    );

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

    return NextResponse.json({ reviews });
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

    await db.runTransaction(async (transaction) => {
      const existingReview = await transaction.get(reviewRef);
      if (existingReview.exists) {
        throw new Error("You already reviewed this booking");
      }
      const transactionCourtDoc = await transaction.get(courtRef);
      const transactionCourt = transactionCourtDoc.exists
        ? transactionCourtDoc.data()
        : court;

      const revieweeId =
        reviewerRole === "player" ? court.ownerId : booking.userId;
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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const message = err.message || "Failed to submit review";
    const status = message.includes("already reviewed") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
