"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, isMockMode } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { getMockConversationsForUser, getMockMessagesForConversation, createMockMessage, type MockConversation, type MockMessage } from "@/lib/mockData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarDays, MessageCircle, Star, Send } from "lucide-react";

type Conversation = MockConversation & {
  createdAt?: any;
  lastMessageAt?: any;
  bookingDate?: string;
  bookingTime?: string;
  bookingDurationMinutes?: number;
  bookingCourtNumber?: number;
};

type Message = MockMessage & { createdAt?: any };

type BookingConversationChatProps = {
  conversationId: string;
  otherParticipantName: string;
  otherParticipantImageUrl?: string;
  courtName?: string;
  otherParticipantRoleLabel?: string;
  otherParticipantRating?: string;
  otherParticipantReviewCount?: number;
  onParticipantClick?: () => void;
  showBookingMeta?: boolean;
};

const getDateValue = (value: any) => {
  if (!value) return new Date(0);
  if (typeof value === "string") return new Date(value);
  if (typeof value?.toDate === "function") return value.toDate();
  return new Date(value);
};

const formatMessageTime = (value: any) => {
  const date = getDateValue(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function BookingConversationChat({
  conversationId,
  otherParticipantName,
  otherParticipantImageUrl,
  courtName,
  otherParticipantRoleLabel,
  otherParticipantRating,
  otherParticipantReviewCount = 0,
  onParticipantClick,
  showBookingMeta = true,
}: BookingConversationChatProps) {
  const { user, loading: authLoading } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isParticipant = useMemo(() => {
    if (!user) return false;
    if (!conversation) return false;
    return conversation.participantIds.includes(user.uid);
  }, [conversation, user]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!conversationId) return;
      if (authLoading) return;

      if (!user) {
        setError("You must be signed in to view messages.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        if (isMockMode) {
          const conversationsForUser = getMockConversationsForUser(user.uid);
          const found = conversationsForUser.find((c) => c.id === conversationId) || null;
          if (!found) {
            setConversation(null);
            setMessages([]);
            setError("Conversation not found.");
            return;
          }
          if (cancelled) return;
          setConversation(found as Conversation);
          setMessages(getMockMessagesForConversation(conversationId) as Message[]);
          return;
        }

        const conversationDoc = await getDoc(doc(db, "conversations", conversationId));
        if (!conversationDoc.exists()) {
          setError("Conversation not found.");
          setConversation(null);
          setMessages([]);
          return;
        }

        const conversationData = conversationDoc.data() as Conversation;
        if (cancelled) return;
        setConversation(conversationData);

        const messageSnap = await getDocs(
          collection(db, "conversations", conversationId, "messages")
        );
        const messageData: Message[] = messageSnap.docs.map((m) => ({
          id: m.id,
          ...(m.data() as any),
        }));
        messageData.sort((a, b) => getDateValue(a.createdAt).getTime() - getDateValue(b.createdAt).getTime());
        setMessages(messageData);
      } catch (err: any) {
        setError(err.message || "Failed to load messages.");
        setConversation(null);
        setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [authLoading, conversationId, user]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    if (!user) return;
    if (!conversation) return;

    setSending(true);
    try {
      if (isMockMode) {
        await createMockMessage(conversationId, user.uid, body);
        // Reload messages for simplicity (small list).
        setMessages(getMockMessagesForConversation(conversationId) as Message[]);
        setDraft("");
        return;
      }

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        body,
        createdAt: serverTimestamp(),
        type: "text",
      });

      const unreadBy = conversation.participantIds.filter((participantId) => participantId !== user.uid);
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessageText: body,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        unreadBy,
        updatedAt: serverTimestamp(),
      });

      // Reload to reflect serverTimestamp ordering.
      const messageSnap = await getDocs(collection(db, "conversations", conversationId, "messages"));
      const messageData: Message[] = messageSnap.docs.map((m) => ({
        id: m.id,
        ...(m.data() as any),
      }));
      messageData.sort(
        (a, b) => getDateValue(a.createdAt).getTime() - getDateValue(b.createdAt).getTime()
      );
      setMessages(messageData);
      setDraft("");
    } catch (err: any) {
      alert(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Card className="rounded-3xl border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <MessageCircle className="h-5 w-5 text-slate-400" />
          Loading chat…
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-3xl border-slate-200 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-600">{error}</p>
      </Card>
    );
  }

  if (!conversation) {
    return (
      <Card className="rounded-3xl border-slate-200 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600">No conversation found.</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
        <button
          type="button"
          onClick={onParticipantClick}
          disabled={!onParticipantClick}
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-2xl text-left",
            onParticipantClick && "transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          )}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={otherParticipantImageUrl || undefined} alt={otherParticipantName} />
            <AvatarFallback>{otherParticipantName.trim().charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-sm font-semibold text-slate-950">{otherParticipantName}</p>
              {otherParticipantRating && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {otherParticipantRating}
                  <span className="font-medium text-slate-500">
                    ({otherParticipantReviewCount})
                  </span>
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">
              {otherParticipantRoleLabel || courtName || "Court conversation"}
            </p>
          </div>
        </button>

        {showBookingMeta && !!conversation.bookingDate && (
          <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            <span>
              {conversation.bookingDate} {conversation.bookingTime ? `· ${conversation.bookingTime}` : ""}
            </span>
          </div>
        )}
      </div>

      {!isParticipant ? (
        <div className="p-6">
          <p className="text-sm font-medium text-red-600">
            You don’t have permission to view this conversation.
          </p>
        </div>
      ) : (
        <>
          <div className="max-h-[360px] overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No messages yet.
              </div>
            ) : (
              messages.map((message) => {
                const mine = message.senderId === user?.uid;
                return (
                  <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                        mine
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-white text-slate-800"
                      )}
                    >
                      <p className="leading-6 whitespace-pre-wrap">{message.body}</p>
                      <p
                        className={cn(
                          "mt-2 text-xs",
                          mine ? "text-emerald-50" : "text-slate-400"
                        )}
                      >
                        {formatMessageTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-200 p-4">
            <div className="flex items-end gap-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message…"
                className="min-h-12 resize-none rounded-2xl border-slate-200 bg-white"
              />
              <Button
                className="h-12 rounded-2xl bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
