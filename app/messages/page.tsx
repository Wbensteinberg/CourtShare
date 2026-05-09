"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import AppHeader from "@/components/AppHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { db, isMockMode } from "@/lib/firebase";
import {
  createMockMessage,
  getMockConversationsForUser,
  getMockMessagesForConversation,
  getMockUserDisplayName,
  type MockConversation,
  type MockMessage,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { CalendarDays, MessageCircle, Send, UserRound } from "lucide-react";

type Conversation = MockConversation & {
  createdAt?: any;
  lastMessageAt?: any;
  updatedAt?: any;
  bookingDate?: string;
  bookingTime?: string;
  bookingDurationMinutes?: number;
  bookingCourtNumber?: number;
};

type Message = MockMessage & {
  createdAt?: any;
};

const getDateValue = (value: any) => {
  if (!value) return new Date(0);
  if (typeof value === "string") return new Date(value);
  if (typeof value.toDate === "function") return value.toDate();
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

const formatFallbackName = (uid: string, role: "player" | "owner") => {
  if (!uid) return role === "player" ? "Player" : "Court owner";
  return role === "player" ? "Player" : "Court owner";
};

const getBookingSummary = (conversation: Conversation) => {
  const pieces = [
    conversation.bookingDate,
    conversation.bookingTime,
    conversation.bookingDurationMinutes
      ? `${conversation.bookingDurationMinutes / 60}h`
      : null,
    conversation.bookingCourtNumber && conversation.bookingCourtNumber > 1
      ? `Court ${conversation.bookingCourtNumber}`
      : null,
  ].filter(Boolean);

  return pieces.length > 0 ? pieces.join(" · ") : "Booking request";
};

function MessagesPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/messages");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!user) return;

      setLoading(true);
      setError("");
      try {
        const conversationData: Conversation[] = isMockMode
          ? getMockConversationsForUser(user.uid)
          : ((await getDocs(
              query(
                collection(db, "conversations"),
                where("participantIds", "array-contains", user.uid)
              )
            )).docs.map((conversationDoc) => ({
              id: conversationDoc.id,
              ...conversationDoc.data(),
            })) as Conversation[]);

        conversationData.sort(
          (a, b) =>
            getDateValue(b.lastMessageAt).getTime() -
            getDateValue(a.lastMessageAt).getTime()
        );

        setConversations(conversationData);
        const requestedConversationId = searchParams.get("conversationId");
        setSelectedConversationId((current) => {
          if (
            requestedConversationId &&
            conversationData.some((item) => item.id === requestedConversationId)
          ) {
            return requestedConversationId;
          }

          if (current && conversationData.some((item) => item.id === current)) {
            return current;
          }

          return conversationData[0]?.id || "";
        });
      } catch (err: any) {
        setError(err.message || "Failed to load messages");
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [searchParams, user]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }

      try {
        const messageData: Message[] = isMockMode
          ? getMockMessagesForConversation(selectedConversationId)
          : ((await getDocs(
              collection(
                db,
                "conversations",
                selectedConversationId,
                "messages"
              )
            )).docs.map((messageDoc) => ({
              id: messageDoc.id,
              ...messageDoc.data(),
            })) as Message[]);

        messageData.sort(
          (a, b) =>
            getDateValue(a.createdAt).getTime() -
            getDateValue(b.createdAt).getTime()
        );
        setMessages(messageData);
      } catch (err: any) {
        setError(err.message || "Failed to load this conversation");
      }
    };

    fetchMessages();
  }, [selectedConversationId]);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId
      ) || null,
    [conversations, selectedConversationId]
  );

  const getOtherParticipantName = (conversation: Conversation) => {
    if (!user) return "Guest";
    if (conversation.playerId === user.uid) {
      return (
        conversation.ownerName ||
        (isMockMode
          ? getMockUserDisplayName(conversation.ownerId)
          : formatFallbackName(conversation.ownerId, "owner"))
      );
    }

    return (
      conversation.playerName ||
      (isMockMode
        ? getMockUserDisplayName(conversation.playerId)
        : formatFallbackName(conversation.playerId, "player"))
    );
  };

  const getPlayerName = (conversation: Conversation) => {
    if (conversation.playerId === user?.uid) {
      return user.displayName || user.email?.split("@")[0] || "You";
    }

    return (
      conversation.playerName ||
      (isMockMode
        ? getMockUserDisplayName(conversation.playerId)
        : formatFallbackName(conversation.playerId, "player"))
    );
  };

  const handleSendMessage = async () => {
    const body = draft.trim();
    if (!user || !selectedConversation || !body) return;

    setSending(true);
    try {
      if (isMockMode) {
        await createMockMessage(selectedConversation.id, user.uid, body);
      } else {
        await addDoc(
          collection(db, "conversations", selectedConversation.id, "messages"),
          {
            senderId: user.uid,
            body,
            createdAt: serverTimestamp(),
            type: "text",
          }
        );
        await updateDoc(doc(db, "conversations", selectedConversation.id), {
          lastMessageText: body,
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: user.uid,
          unreadBy: selectedConversation.participantIds.filter(
            (participantId) => participantId !== user.uid
          ),
          updatedAt: serverTimestamp(),
        });
      }

      setDraft("");
      const sentMessage: Message = {
        id: `local-${Date.now()}`,
        conversationId: selectedConversation.id,
        senderId: user.uid,
        body,
        createdAt: new Date().toISOString(),
        type: "text",
      };
      setMessages((current) => [...current, sentMessage]);
      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === selectedConversation.id
              ? {
                  ...conversation,
                  lastMessageText: body,
                  lastMessageAt: new Date().toISOString(),
                  lastMessageSenderId: user.uid,
                  unreadBy: conversation.participantIds.filter(
                    (participantId) => participantId !== user.uid
                  ),
                }
              : conversation
          )
          .sort(
            (a, b) =>
              getDateValue(b.lastMessageAt).getTime() -
              getDateValue(a.lastMessageAt).getTime()
          )
      );
    } catch (err: any) {
      alert(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm font-medium text-slate-500">
            Loading messages...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Messages</h1>
              <p className="text-sm text-slate-500">
                Booking requests and court conversations live here.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="grid min-h-[620px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Inbox
              </h2>
            </div>
            {conversations.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No conversations yet. New booking requests will appear here
                after Firestore rules are updated.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {conversations.map((conversation) => {
                  const isSelected = conversation.id === selectedConversationId;
                  const unread = user
                    ? conversation.unreadBy?.includes(user.uid)
                    : false;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      className={cn(
                        "flex w-full gap-3 p-4 text-left transition-colors hover:bg-slate-50",
                        isSelected && "bg-emerald-50"
                      )}
                      onClick={() => setSelectedConversationId(conversation.id)}
                    >
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className="bg-slate-100 text-sm font-semibold text-slate-700">
                          {getOtherParticipantName(conversation)
                            .trim()
                            .charAt(0)
                            .toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {getOtherParticipantName(conversation)}
                          </p>
                          {unread && (
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          {conversation.courtName || "Court booking"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {conversation.lastMessageText}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div className="flex min-h-[620px] flex-col">
            {selectedConversation ? (
              <>
                <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-emerald-100 font-semibold text-emerald-800">
                        {getOtherParticipantName(selectedConversation)
                          .trim()
                          .charAt(0)
                          .toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        {getOtherParticipantName(selectedConversation)}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selectedConversation.courtName || "Court booking"}
                      </p>
                    </div>
                  </div>
                  <Badge className="w-fit bg-amber-100 text-amber-800 hover:bg-amber-100">
                    Booking request
                  </Badge>
                </div>

                <div className="border-b border-slate-200 bg-slate-50/70 p-5">
                  <Card className="rounded-2xl border-slate-200 shadow-none">
                    <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <UserRound className="h-4 w-4 text-emerald-600" />
                        {getPlayerName(selectedConversation)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 text-emerald-600" />
                        {getBookingSummary(selectedConversation)}
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() =>
                          selectedConversation.bookingId &&
                          router.push(`/booking/${selectedConversation.bookingId}`)
                        }
                        disabled={!selectedConversation.bookingId}
                      >
                        View booking
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {messages.map((message) => {
                    const mine = message.senderId === user?.uid;
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          mine ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                            mine
                              ? "bg-emerald-600 text-white"
                              : "border border-slate-200 bg-white text-slate-800"
                          )}
                        >
                          <p className="leading-6">{message.body}</p>
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
                  })}
                </div>

                <div className="border-t border-slate-200 p-4">
                  <div className="flex gap-3">
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Write a message..."
                      className="min-h-12 resize-none rounded-2xl border-slate-200 bg-white"
                    />
                    <Button
                      className="h-12 rounded-2xl bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                      onClick={handleSendMessage}
                      disabled={!draft.trim() || sending}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center">
                <div>
                  <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-950">
                    Select a conversation
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    New booking request messages will appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <AppHeader />
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-sm font-medium text-slate-500">
              Loading messages...
            </p>
          </div>
        </div>
      }
    >
      <MessagesPageContent />
    </Suspense>
  );
}
