import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isNextResponse, requireFirebaseUser } from "@/lib/apiSecurity";

const serializeDate = (value: any) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toISOString();
  }
  return null;
};

const serializeDoc = (doc: any) => ({
  id: doc.id,
  ...doc.data(),
});


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const uidResult = await requireFirebaseUser(req, adminAuth);
    if (isNextResponse(uidResult)) return uidResult;
    const uid = uidResult.uid;
    const { conversationId } = await params;
    const normalizedConversationId = decodeURIComponent(conversationId || "");

    if (!normalizedConversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 }
      );
    }

    const conversationRef = adminDb
      .collection("conversations")
      .doc(normalizedConversationId);
    const conversationDoc = await conversationRef.get();

    if (!conversationDoc.exists) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const conversation = conversationDoc.data() || {};
    const participantIds = Array.isArray(conversation.participantIds)
      ? conversation.participantIds.filter((id: unknown) => typeof id === "string")
      : [];

    let allowed = participantIds.includes(uid);
    let repairedParticipantIds = participantIds;

    const conversationBookingId =
      typeof conversation.bookingId === "string"
        ? conversation.bookingId
        : normalizedConversationId.startsWith("booking_")
          ? normalizedConversationId.replace(/^booking_/, "")
          : "";

    if (!allowed && conversationBookingId) {
      const bookingDoc = await adminDb
        .collection("bookings")
        .doc(conversationBookingId)
        .get();
      if (bookingDoc.exists) {
        const booking = bookingDoc.data() || {};
        const courtId =
          typeof booking.courtId === "string"
            ? booking.courtId
            : typeof conversation.courtId === "string"
              ? conversation.courtId
              : "";
        const courtDoc = courtId
          ? await adminDb.collection("courts").doc(courtId).get()
          : null;
        const court = courtDoc?.exists ? courtDoc.data() || {} : {};
        const ownerId =
          typeof booking.ownerId === "string"
            ? booking.ownerId
            : typeof court.ownerId === "string"
              ? court.ownerId
              : typeof conversation.ownerId === "string"
                ? conversation.ownerId
                : "";
        const playerId =
          typeof booking.userId === "string"
            ? booking.userId
            : typeof conversation.playerId === "string"
              ? conversation.playerId
              : "";

        allowed = uid === playerId || uid === ownerId;
        repairedParticipantIds = [playerId, ownerId].filter(Boolean);
      }
    }

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to view this conversation" },
        { status: 403 }
      );
    }

    if (
      repairedParticipantIds.length > 0 &&
      repairedParticipantIds.some((id) => !participantIds.includes(id))
    ) {
      await conversationRef.set(
        { participantIds: repairedParticipantIds },
        { merge: true }
      );
    }

    const messagesSnap = await conversationRef.collection("messages").get();
    const messages = messagesSnap.docs
      .map((messageDoc) => {
        const message = serializeDoc(messageDoc) as any;
        return {
          ...message,
          createdAt: serializeDate(message.createdAt),
        };
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      );

    return NextResponse.json({
      conversation: {
        id: conversationDoc.id,
        ...conversation,
        participantIds:
          repairedParticipantIds.length > 0
            ? repairedParticipantIds
            : participantIds,
        createdAt: serializeDate(conversation.createdAt),
        updatedAt: serializeDate(conversation.updatedAt),
        lastMessageAt: serializeDate(conversation.lastMessageAt),
      },
      messages,
    });
  } catch (err: any) {
    const message = err.message || "Failed to load conversation";
    return NextResponse.json(
      { error: message },
      { status: message.includes("authorization") ? 401 : 500 }
    );
  }
}
