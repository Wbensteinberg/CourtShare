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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import CourtListingHostCard from "@/components/CourtListingHostCard";
import { useAuth } from "@/lib/AuthContext";
import { db, isMockMode } from "@/lib/firebase";
import {
  createMockMessage,
  getMockBookingById,
  getMockConversationsForUser,
  getMockMessagesForConversation,
  getMockProfile,
  getMockReviewsForTarget,
  getMockUserDisplayName,
  markMockConversationRead,
  updateMockBooking,
  type MockConversation,
  type MockMessage,
} from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { CalendarDays, Check, MessageCircle, Send, Star, X } from "lucide-react";

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
  uid?: string;
  displayName: string;
  profileImageUrl: string;
  bio?: string;
  isOwner?: boolean;
  playerRating?: number | null;
  playerReviewCount?: number;
  ownerRating?: number | null;
  ownerReviewCount?: number;
  memberSince?: string | null;
  confirmedBookingsCount?: number;
  listingsCount?: number;
};

type ParticipantReview = {
  id: string;
  rating: number;
  comment?: string;
  createdAt?: string | null;
  targetType?: string;
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

const formatProfileReviewDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const getMonthCountFromMemberSince = (iso?: string | null) => {
  if (!iso) return 0;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - start.getFullYear()) * 12 +
      now.getMonth() -
      start.getMonth()
  );
};

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
    conversation.courtName || "Court booking",
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
  const [participantReviews, setParticipantReviews] = useState<Record<string, ParticipantReview[]>>({});
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
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
	                  uid: participantId,
	                  displayName:
	                    profile?.displayName || getMockUserDisplayName(participantId),
	                  profileImageUrl: profile?.profileImageUrl || "",
	                  bio: profile?.bio || "",
	                  isOwner: profile?.isOwner || false,
	                  playerRating: profile?.playerRating ?? null,
	                  playerReviewCount: profile?.playerReviewCount ?? 0,
	                  ownerRating: profile?.ownerRating ?? null,
	                  ownerReviewCount: profile?.ownerReviewCount ?? 0,
	                  memberSince: profile?.createdAt ?? null,
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
	                  uid: data.profile.uid || participantId,
	                  displayName: getProfileDisplayName(
	                    data.profile,
	                    "CourtShare user"
	                  ),
                  profileImageUrl:
	                    typeof data.profile.profileImageUrl === "string"
	                      ? data.profile.profileImageUrl
	                      : "",
	                  bio: data.profile.bio || "",
	                  isOwner: Boolean(data.profile.isOwner),
	                  playerRating: data.profile.playerRating ?? null,
	                  playerReviewCount: data.profile.playerReviewCount ?? 0,
	                  ownerRating: data.profile.ownerRating ?? null,
	                  ownerReviewCount: data.profile.ownerReviewCount ?? 0,
	                  memberSince: data.profile.memberSince ?? null,
	                  confirmedBookingsCount: data.profile.confirmedBookingsCount ?? 0,
	                  listingsCount: data.profile.listingsCount ?? 0,
	                }
	              : { uid: participantId, displayName: "CourtShare user", profileImageUrl: "" },
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
    const loadParticipantReviews = async () => {
      const participantIds = Array.from(
        new Set(conversations.flatMap((conversation) => conversation.participantIds))
      ).filter(Boolean);

      if (participantIds.length === 0) {
        setParticipantReviews({});
        return;
      }

      if (isMockMode) {
        setParticipantReviews(
          Object.fromEntries(
            participantIds.map((participantId) => [
              participantId,
              getMockReviewsForTarget(participantId) as ParticipantReview[],
            ])
          )
        );
        return;
      }

      const entries = await Promise.allSettled(
        participantIds.map(async (participantId) => {
          const res = await fetch(`/api/reviews?targetUserId=${encodeURIComponent(participantId)}`);
          const data = await res.json().catch(() => ({}));
          return [
            participantId,
            res.ok && Array.isArray(data.reviews) ? data.reviews : [],
          ] as const;
        })
      );

      setParticipantReviews(
        Object.fromEntries(
          entries.flatMap((entry) =>
            entry.status === "fulfilled" ? [entry.value] : []
          )
        )
      );
    };

    loadParticipantReviews();
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
  const selectedOtherParticipantId = selectedConversation
    ? getOtherParticipantId(selectedConversation)
    : "";
  const selectedOtherParticipantProfile = selectedConversation
    ? getOtherParticipantProfile(selectedConversation)
    : undefined;
  const selectedOtherParticipantName = selectedConversation
    ? getOtherParticipantName(selectedConversation)
    : "";
  const selectedOtherParticipantRole =
    selectedConversation?.ownerId === selectedOtherParticipantId ||
    selectedOtherParticipantProfile?.isOwner
      ? "Host"
      : "Player";
  const selectedOtherParticipantReviews =
    (selectedOtherParticipantId && participantReviews[selectedOtherParticipantId]) || [];
  const selectedOtherParticipantHostReviews = selectedOtherParticipantReviews.filter(
    (review) => review.targetType === "court_owner"
  );
  const selectedOtherParticipantPlayerReviews = selectedOtherParticipantReviews.filter(
    (review) => review.targetType === "player"
  );
  const selectedOtherParticipantRating =
    selectedOtherParticipantRole === "Host"
      ? selectedOtherParticipantProfile?.ownerRating
      : selectedOtherParticipantProfile?.playerRating;
  const selectedOtherParticipantReviewCount =
    selectedOtherParticipantRole === "Host"
      ? selectedOtherParticipantProfile?.ownerReviewCount ?? selectedOtherParticipantHostReviews.length
      : selectedOtherParticipantProfile?.playerReviewCount ?? selectedOtherParticipantPlayerReviews.length;

  const openParticipantProfile = (conversation: Conversation) => {
    const participantId = getOtherParticipantId(conversation);
    if (participantId) setProfileDialogOpen(true);
  };

  const updateConversationStatus = (
    conversation: Conversation,
    status: Conversation["status"],
    lastMessageText: string
  ) => {
    const now = new Date().toISOString();

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
      let lastMessageText =
        decision === "accepted"
          ? "Booking request accepted."
          : "Booking request declined.";
      let statusMessage: Message | null = null;

      if (isMockMode) {
        await updateMockBooking(selectedBooking.id, { status: nextStatus });
        await createMockMessage(selectedConversation.id, user.uid, lastMessageText);
        statusMessage = {
          id: `local-${decision}-${Date.now()}`,
          conversationId: selectedConversation.id,
          senderId: user.uid,
          body: lastMessageText,
          createdAt: new Date().toISOString(),
          type: "booking_status",
        };
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
        if (data.conversationMessage?.body) {
          lastMessageText = data.conversationMessage.body;
          statusMessage = {
            id:
              data.conversationMessage.messageId ||
              `local-${decision}-${Date.now()}`,
            conversationId:
              data.conversationMessage.conversationId ||
              selectedConversation.id,
            senderId: user.uid,
            body: data.conversationMessage.body,
            createdAt: new Date().toISOString(),
            type: "booking_status",
          };
        }
      }

      updateConversationStatus(
        selectedConversation,
        conversationStatus,
        lastMessageText
      );
      if (statusMessage) {
        setMessages((current) => [...current, statusMessage as Message]);
      }
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
                <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center xl:justify-between">
                  <button
                    type="button"
                    className="flex items-center gap-3 rounded-2xl text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    onClick={() => openParticipantProfile(selectedConversation)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={selectedOtherParticipantProfile?.profileImageUrl || undefined}
                        alt={selectedOtherParticipantName}
                      />
                      <AvatarFallback className="bg-emerald-100 font-semibold text-emerald-800">
                        {selectedOtherParticipantName
                          .trim()
                          .charAt(0)
                          .toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        {selectedOtherParticipantName}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selectedOtherParticipantRole}
                      </p>
                    </div>
	                  </button>
	                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
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
	                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
	                      <CalendarDays className="h-4 w-4 text-emerald-600" />
	                      {getBookingSummary(selectedConversation)}
	                    </div>
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
	        {selectedOtherParticipantRole === "Host" ? (
	          <CourtListingHostCard
	            hostProfile={
	              selectedOtherParticipantProfile
	                ? { ...selectedOtherParticipantProfile, isOwner: true }
	                : null
	            }
            hostReviews={selectedOtherParticipantHostReviews}
            ownerId={selectedOtherParticipantId || undefined}
            avatarImageUrl={selectedOtherParticipantProfile?.profileImageUrl || undefined}
            triggerVariant="none"
            open={profileDialogOpen}
            onOpenChange={setProfileDialogOpen}
          />
        ) : (
          <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl border-slate-200 sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-left text-xl font-bold text-slate-950">
                  {selectedOtherParticipantName || "Player"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-2">
                <Card className="rounded-[32px] border-slate-200 shadow-sm">
                  <CardContent className="grid gap-8 p-8 sm:grid-cols-[1fr_170px] sm:p-10">
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="h-28 w-28 border-4 border-white shadow-md md:h-32 md:w-32">
                        <AvatarImage
                          src={selectedOtherParticipantProfile?.profileImageUrl || undefined}
                          alt={selectedOtherParticipantName || "Player"}
                        />
                        <AvatarFallback className="bg-emerald-100 text-3xl font-bold text-emerald-800">
                          {(selectedOtherParticipantName || "P").trim().charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <h2 className="mt-5 text-2xl font-bold text-slate-950 md:text-3xl">
                        {selectedOtherParticipantName || "Player"}
                      </h2>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Badge variant="secondary">Player</Badge>
                        {selectedOtherParticipantRating != null ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Player rating {selectedOtherParticipantRating.toFixed(1)}
                          </Badge>
                        ) : null}
                      </div>
                      {selectedOtherParticipantProfile?.bio ? (
                        <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600 md:text-base md:leading-7">
                          {selectedOtherParticipantProfile.bio}
                        </p>
                      ) : (
                        <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500 md:text-base md:leading-7">
                          This member has not added a bio yet.
                        </p>
                      )}
                    </div>

                    <div className="grid content-center divide-y divide-slate-200">
                      <div className="py-4 first:pt-0">
                        <p className="text-3xl font-black text-slate-950">
                          {selectedOtherParticipantProfile?.confirmedBookingsCount ?? 0}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">Bookings</p>
                      </div>
                      <div className="py-4">
                        <p className="text-3xl font-black text-slate-950">
                          {selectedOtherParticipantReviewCount}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">Reviews</p>
                      </div>
                      <div className="py-4">
                        <p className="text-3xl font-black text-slate-950">
                          {getMonthCountFromMemberSince(selectedOtherParticipantProfile?.memberSince)}
                        </p>
                        <p className="text-sm font-semibold text-slate-600">Months on CourtShare</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[32px] border-slate-200 shadow-sm">
                  <CardContent className="space-y-4 p-6">
                    <div>
                      <h3 className="text-xl font-bold text-slate-950">Reviews</h3>
                      <p className="text-sm text-slate-500">
                        Feedback from completed CourtShare bookings.
                      </p>
                    </div>
                    {selectedOtherParticipantPlayerReviews.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                        No reviews yet.
                      </p>
                    ) : (
                      selectedOtherParticipantPlayerReviews.map((review) => (
                        <div key={review.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-semibold text-slate-950">{review.rating}/5</span>
                              <Badge variant="outline">Player review</Badge>
                            </div>
                            <span className="text-xs text-slate-500">
                              {formatProfileReviewDate(review.createdAt)}
                            </span>
                          </div>
                          {review.comment ? (
                            <p className="mt-3 text-sm leading-6 text-slate-700">{review.comment}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
