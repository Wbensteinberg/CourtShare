import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendConversationMessageEmail } from "@/lib/email";
import { isMockApiMode } from "@/lib/mockApiMode";

const getDisplayName = (profile: FirebaseFirestore.DocumentData | undefined) => {
  const displayName = String(profile?.displayName || profile?.name || "").trim();
  if (displayName) return displayName;

  const email = String(profile?.email || "").trim();
  if (email) return email.split("@")[0];

  return "CourtShare user";
};

export async function POST(req: NextRequest) {
  try {
    if (isMockApiMode()) {
      return NextResponse.json(
        { error: "Mock mode should use local mock message helpers" },
        { status: 501 }
      );
    }

    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }
    const db = adminDb;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(
      authHeader.split("Bearer ")[1],
      true
    );
    const senderId = decodedToken.uid;
    const { conversationId, body } = await req.json();
    const normalizedConversationId =
      typeof conversationId === "string" ? conversationId.trim() : "";
    const normalizedBody = typeof body === "string" ? body.trim().slice(0, 4000) : "";

    if (!normalizedConversationId || !normalizedBody) {
      return NextResponse.json(
        { error: "Conversation ID and message are required" },
        { status: 400 }
      );
    }

    const conversationRef = db
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

    if (!participantIds.includes(senderId)) {
      return NextResponse.json(
        { error: "Only conversation participants can send messages" },
        { status: 403 }
      );
    }

    const recipientIds = participantIds.filter((id: string) => id !== senderId);
    const messageRef = await conversationRef.collection("messages").add({
      senderId,
      body: normalizedBody,
      createdAt: FieldValue.serverTimestamp(),
      type: "text",
      bookingId: conversation.bookingId || null,
      courtId: conversation.courtId || null,
    });

    await conversationRef.update({
      lastMessageText: normalizedBody,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageSenderId: senderId,
      unreadBy: recipientIds,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const [senderDoc, ...recipientDocs] = await Promise.all([
      db.collection("users").doc(senderId).get(),
      ...recipientIds.map((recipientId: string) =>
        db.collection("users").doc(recipientId).get()
      ),
    ]);
    const senderProfile = senderDoc.exists ? senderDoc.data() : undefined;
    const senderName = getDisplayName(senderProfile);

    await Promise.allSettled(
      recipientDocs.map(async (recipientDoc) => {
        const recipientProfile = recipientDoc.exists ? recipientDoc.data() : undefined;
        const recipientEmail = String(recipientProfile?.email || "").trim();
        if (!recipientEmail) return;

        await sendConversationMessageEmail({
          recipientEmail,
          recipientName: getDisplayName(recipientProfile),
          senderName,
          courtName:
            typeof conversation.courtName === "string" ? conversation.courtName : "",
          messageBody: normalizedBody,
          conversationId: normalizedConversationId,
        });
      })
    );

    return NextResponse.json({
      success: true,
      message: {
        id: messageRef.id,
        conversationId: normalizedConversationId,
        senderId,
        body: normalizedBody,
        createdAt: new Date().toISOString(),
        type: "text",
      },
    });
  } catch (err: any) {
    console.error("[SEND-MESSAGE] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send message" },
      { status: 500 }
    );
  }
}
