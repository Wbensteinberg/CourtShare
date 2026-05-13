"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import AppHeader from "@/components/AppHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { db, isMockMode } from "@/lib/firebase";
import {
  createMockMessage,
  getMockBookingById,
  getMockConversationsForUser,
  getMockMessagesForConversation,
  getMockProfile,
  getMockUserDisplayName,
  markMockConversationRead,
  updateMockBooking,
  type MockConversation,
  type MockMessage,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, MessageCircle, Send, UserRound, X } from "lucide-react";

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

type Booking = {
  id: string;
  courtId: string;
  userId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
};

type ParticipantProfile = {
  displayName: string;
  profileImageUrl: string;
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

const formatFullDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatTextDates = (text?: string) =>
  (text || "").replace(/\b\d{4}-\d{2}-\d{2}\b/g, (date) =>
    formatFullDate(date)
  );

const getProfileDisplayName = (
  profile: Record<string, any> | undefined,
  fallback: string
) => {
  const displayName =
    typeof profile?.displayName === "string" ? profile.displayName.trim() : "";
  const name = typeof profile?.name === "string" ? profile.name.trim() : "";
  const emailPrefix =
    typeof profile?.email === "string" ? profile.email.split("@")[0].trim() : "";

  return displayName || name || emailPrefix || fallback;
};

const formatFallbackName = (uid: string, role: "player" | "owner") => {
  if (!uid) return role === "player" ? "Player" : "Court host";
  return role === "player" ? "Player" : "Court host";
};

const getBookingSummary = (conversation: Conversation) => {
  const pieces = [
    formatFullDate(conversation.bookingDate),
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
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [participantProfiles, setParticipantProfiles] = useState<
    Record<string, ParticipantProfile>
  >({});
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingBooking, setUpdatingBooking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
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
        const requestedBookingId =
          searchParams.get("bookingId") ||
          (requestedConversationId?.startsWith("booking_")
            ? requestedConversationId.slice("booking_".length)
            : "");
        setSelectedConversationId((current) => {
          if (
            requestedConversationId &&
            conversationData.some((item) => item.id === requestedConversationId)
          ) {
            return requestedConversationId;
          }

          if (requestedBookingId) {
            return (
              conversationData.find(
                (item) => item.bookingId === requestedBookingId
              )?.id || ""
            );
          }

          if (requestedConversationId) {
            return "";
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
    const loadParticipantNames = async () => {
      const participantIds = Array.from(
        new Set(conversations.flatMap((conversation) => conversation.participantIds))
      ).filter(Boolean);

      if (participantIds.length === 0) {
        setParticipantProfiles({});
        return;
      }

      if (isMockMode) {
        setParticipantProfiles(
          Object.fromEntries(
            participantIds.map((participantId) => {
              const profile = getMockProfile(participantId);
              return [
                participantId,
                {
                  displayName:
                    profile?.displayName || getMockUserDisplayName(participantId),
                  profileImageUrl: profile?.profileImageUrl || "",
                },
              ];
            })
          )
        );
        return;
      }

      const entries = await Promise.allSettled(
        participantIds.map(async (participantId) => {
          const res = await fetch(
            `/api/public-profiles/${encodeURIComponent(participantId)}`
          );
          const data = await res.json().catch(() => ({}));
          return [
            participantId,
            res.ok && data.profile
              ? {
                  displayName: getProfileDisplayName(
                    data.profile,
                    "CourtShare user"
                  ),
                  profileImageUrl:
                    typeof data.profile.profileImageUrl === "string"
                      ? data.profile.profileImageUrl
                      : "",
                }
              : { displayName: "CourtShare user", profileImageUrl: "" },
          ] as const;
        })
      );

      setParticipantProfiles(
        Object.fromEntries(
          entries
            .flatMap((entry) =>
              entry.status === "fulfilled" ? [entry.value] : []
            )
        )
      );
    };

    loadParticipantNames();
  }, [conversations]);

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

  useEffect(() => {
    const fetchSelectedBooking = async () => {
      if (!selectedConversation?.bookingId) {
        setSelectedBooking(null);
        return;
      }

      try {
        const bookingData = isMockMode
          ? (getMockBookingById(selectedConversation.bookingId) as Booking | null)
          : await (async () => {
              const bookingDoc = await getDoc(
                doc(db, "bookings", selectedConversation.bookingId!)
              );
              return bookingDoc.exists()
                ? ({ id: bookingDoc.id, ...bookingDoc.data() } as Booking)
                : null;
            })();

        setSelectedBooking(bookingData);
      } catch (err) {
        console.warn("[MESSAGES] Unable to load booking for conversation:", err);
        setSelectedBooking(null);
      }
    };

    fetchSelectedBooking();
  }, [selectedConversation]);

  useEffect(() => {
    const markSelectedConversationRead = async () => {
      if (!user || !selectedConversation) return;
      if (!selectedConversation.unreadBy?.includes(user.uid)) return;

      const unreadBy = selectedConversation.unreadBy.filter(
        (participantId) => participantId !== user.uid
      );

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, unreadBy }
            : conversation
        )
      );

      try {
        if (isMockMode) {
          markMockConversationRead(selectedConversation.id, user.uid);
        } else {
          await updateDoc(doc(db, "conversations", selectedConversation.id), {
            unreadBy,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn("[MESSAGES] Unable to mark conversation read:", err);
      }
    };

    markSelectedConversationRead();
  }, [selectedConversation, user]);

  const getOtherParticipantId = (conversation: Conversation) => {
    if (!user) return conversation.playerId || conversation.ownerId;
    return conversation.playerId === user.uid
      ? conversation.ownerId
      : conversation.playerId;
  };

  const getOtherParticipantProfile = (conversation: Conversation) =>
    participantProfiles[getOtherParticipantId(conversation)];

  const getOtherParticipantName = (conversation: Conversation) => {
    if (!user) return "Guest";
    if (conversation.playerId === user.uid) {
      return (
        participantProfiles[conversation.ownerId]?.displayName ||
        conversation.ownerName ||
        (isMockMode
          ? getMockUserDisplayName(conversation.ownerId)
          : formatFallbackName(conversation.ownerId, "owner"))
      );
    }

    return (
      participantProfiles[conversation.playerId]?.displayName ||
      conversation.playerName ||
      (isMockMode
        ? getMockUserDisplayName(conversation.playerId)
        : formatFallbackName(conversation.playerId, "player"))
    );
  };

  const getPlayerName = (conversation: Conversation) => {
    if (conversation.playerId === user?.uid) {
      return participantProfiles[conversation.playerId]?.displayName || "You";
    }

    return (
      participantProfiles[conversation.playerId]?.displayName ||
      conversation.playerName ||
      (isMockMode
        ? getMockUserDisplayName(conversation.playerId)
      : formatFallbackName(conversation.playerId, "player"))
    );
  };

  const shouldShowBookingParticipant =
    !!selectedConversation &&
    getPlayerName(selectedConversation) !==
      getOtherParticipantName(selectedConversation);

  const isSelectedOwner =
    !!user && !!selectedConversation && selectedConversation.ownerId === user.uid;
  const canActOnSelectedBooking =
    isSelectedOwner && selectedBooking?.status === "pending";

  const openParticipantProfile = (conversation: Conversation) => {
    const participantId = getOtherParticipantId(conversation);
    if (participantId) router.push(`/profile/${participantId}`);
  };

  const updateConversationStatus = async (
    conversation: Conversation,
    status: Conversation["status"],
    lastMessageText: string
  ) => {
    const now = new Date().toISOString();
    if (!isMockMode) {
      await updateDoc(doc(db, "conversations", conversation.id), {
        status,
        lastMessageText,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user?.uid || conversation.ownerId,
        unreadBy: conversation.participantIds.filter(
          (participantId) => participantId !== user?.uid
        ),
        updatedAt: serverTimestamp(),
      });
    }

    setConversations((current) =>
      current.map((item) =>
        item.id === conversation.id
          ? {
              ...item,
              status,
              lastMessageText,
              lastMessageAt: now,
              lastMessageSenderId: user?.uid || conversation.ownerId,
              unreadBy: item.participantIds.filter(
                (participantId) => participantId !== user?.uid
              ),
              updatedAt: now,
            }
          : item
      )
    );
  };

  const handleBookingDecision = async (decision: "accepted" | "declined") => {
    if (!user || !selectedConversation?.bookingId || !selectedBooking) return;

    if (
      decision === "declined" &&
      !window.confirm(
        "Are you sure you want to decline this booking? The card authorization will be released."
      )
    ) {
      return;
    }

    setUpdatingBooking(true);
    try {
      const nextStatus = decision === "accepted" ? "confirmed" : "rejected";
      const conversationStatus =
        decision === "accepted" ? "confirmed" : "closed";
      const lastMessageText =
        decision === "accepted"
          ? "Booking request accepted."
          : "Booking request declined.";

      if (isMockMode) {
        await updateMockBooking(selectedBooking.id, { status: nextStatus });
      } else {
        const idToken = await user.getIdToken();
        const res = await fetch(
          decision === "accepted" ? "/api/accept-booking" : "/api/reject-booking",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ bookingId: selectedBooking.id }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            data.error ||
              (decision === "accepted"
                ? "Failed to accept booking"
                : "Failed to decline booking")
          );
        }
      }

      await updateConversationStatus(
        selectedConversation,
        conversationStatus,
        lastMessageText
      );
      setSelectedBooking((current) =>
        current ? { ...current, status: nextStatus } : current
      );
    } catch (err: any) {
      alert(err.message || "Failed to update booking");
    } finally {
      setUpdatingBooking(false);
    }
  };

  const handleSendMessage = async () => {
    const body = draft.trim();
    if (!user || !selectedConversation || !body) return;

    setSending(true);
    try {
      let sentMessage: Message;
      if (isMockMode) {
        await createMockMessage(selectedConversation.id, user.uid, body);
        sentMessage = {
          id: `local-${Date.now()}`,
          conversationId: selectedConversation.id,
          senderId: user.uid,
          body,
          createdAt: new Date().toISOString(),
          type: "text",
        };
      } else {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/conversations/send-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            conversationId: selectedConversation.id,
            body,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to send message");
        }
        sentMessage = data.message || {
          id: `local-${Date.now()}`,
          conversationId: selectedConversation.id,
          senderId: user.uid,
          body,
          createdAt: new Date().toISOString(),
          type: "text",
        };
      }

      setDraft("");
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
        <div className="border-b border-slate-200 pb-6">
          <h1 className="text-4xl font-black tracking-tight text-slate-950">
            Messages
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Booking requests and court conversations live here.
          </p>
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
                        <AvatarImage
                          src={
                            getOtherParticipantProfile(conversation)
                              ?.profileImageUrl || undefined
                          }
                          alt={getOtherParticipantName(conversation)}
                        />
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
                          {formatTextDates(conversation.lastMessageText)}
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
                  <button
                    type="button"
                    className="flex items-center gap-3 rounded-2xl text-left transition hover:bg-slate-50"
                    onClick={() => openParticipantProfile(selectedConversation)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={
                          getOtherParticipantProfile(selectedConversation)
                            ?.profileImageUrl || undefined
                        }
                        alt={getOtherParticipantName(selectedConversation)}
                      />
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
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => openParticipantProfile(selectedConversation)}
                    >
                      View profile
                    </Button>
                    <Badge
                      className={cn(
                        "w-fit hover:bg-amber-100",
                        selectedBooking?.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          : selectedBooking?.status === "rejected" ||
                              selectedBooking?.status === "cancelled" ||
                              selectedBooking?.status === "expired"
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-100"
                            : "bg-amber-100 text-amber-800 hover:bg-amber-100"
                      )}
                    >
                      {selectedBooking?.status === "confirmed"
                        ? "Confirmed"
                        : selectedBooking?.status === "rejected"
                          ? "Declined"
                          : selectedBooking?.status === "cancelled"
                            ? "Cancelled"
                            : selectedBooking?.status === "expired"
                              ? "Expired"
                              : "Booking request"}
                    </Badge>
                  </div>
                </div>

                <div className="border-b border-slate-200 bg-slate-50/70 p-5">
                  <Card className="rounded-2xl border-slate-200 shadow-none">
                    <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {shouldShowBookingParticipant && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <UserRound className="h-4 w-4 text-emerald-600" />
                            {getPlayerName(selectedConversation)}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 text-emerald-600" />
                        {getBookingSummary(selectedConversation)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {canActOnSelectedBooking && (
                          <>
                            <Button
                              className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                              onClick={() => handleBookingDecision("accepted")}
                              disabled={updatingBooking}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Accept
                            </Button>
                            <Button
                              variant="outline"
                              className="rounded-xl border-black text-black hover:bg-slate-100 hover:text-black"
                              onClick={() => handleBookingDecision("declined")}
                              disabled={updatingBooking}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Decline
                            </Button>
                          </>
                        )}
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
                      </div>
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
                          <p className="leading-6">{formatTextDates(message.body)}</p>
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
