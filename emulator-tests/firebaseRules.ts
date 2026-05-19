import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

let testEnv: RulesTestEnvironment;

const projectId = `courtshare-rules-${Date.now()}`;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/alice"), {
      uid: "alice",
      email: "alice@example.com",
      displayName: "Alice",
    });
    await setDoc(doc(db, "users/bob"), {
      uid: "bob",
      email: "bob@example.com",
      displayName: "Bob",
    });
    await setDoc(doc(db, "courts/activeCourt"), {
      ownerId: "alice",
      name: "Active Court",
      bookableStatus: "active",
      ownerStripeAccountStatus: "active",
      ownerStripeMode: "test",
    });
    await setDoc(doc(db, "courts/draftCourt"), {
      ownerId: "alice",
      name: "Draft Court",
      bookableStatus: "draft",
      ownerStripeAccountStatus: "inactive",
      ownerStripeMode: "test",
    });
    await setDoc(doc(db, "bookings/booking1"), {
      courtId: "activeCourt",
      ownerId: "alice",
      userId: "bob",
      status: "pending",
    });
    await setDoc(doc(db, "conversations/booking_booking1"), {
      participantIds: ["alice", "bob"],
      playerId: "bob",
      ownerId: "alice",
      courtId: "activeCourt",
      bookingId: "booking1",
      unreadBy: ["alice"],
    });
    await setDoc(doc(db, "conversations/booking_booking1/messages/request"), {
      senderId: "bob",
      body: "Booking request",
    });
    await setDoc(doc(db, "reviews/booking1_player"), {
      bookingId: "booking1",
      courtId: "activeCourt",
      reviewerId: "bob",
      reviewerRole: "player",
      revieweeId: "alice",
      targetType: "court_owner",
      rating: 5,
    });
    await setDoc(doc(db, "bookingSlotLocks/lock1"), {
      bookingId: "booking1",
    });
    await setDoc(doc(db, "securityAuditLogs/log1"), {
      eventType: "booking_accepted",
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore rules", () => {
  it("allows users to create and update only their own safe profile fields", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, "users/alice2"), {
        uid: "alice",
        email: "alice@example.com",
        displayName: "Alice",
        isOwner: false,
      })
    );
    await assertSucceeds(
      updateDoc(doc(aliceDb, "users/alice"), {
        displayName: "Alice Updated",
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, "users/alice"), {
        isOwner: true,
      })
    );
    await assertFails(getDoc(doc(bobDb, "users/alice")));
  });

  it("allows active court reads, owner draft reads, and blocks client bookability changes", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(getDoc(doc(anonDb, "courts/activeCourt")));
    await assertFails(getDoc(doc(anonDb, "courts/draftCourt")));
    await assertSucceeds(getDoc(doc(aliceDb, "courts/draftCourt")));
    await assertFails(getDoc(doc(bobDb, "courts/draftCourt")));
    await assertSucceeds(
      setDoc(doc(aliceDb, "courts/newDraft"), {
        ownerId: "alice",
        bookableStatus: "draft",
        name: "New Draft",
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, "courts/draftCourt"), {
        bookableStatus: "active",
      })
    );
  });

  it("restricts bookings to participants and denies all client booking writes", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    const strangerDb = testEnv.authenticatedContext("stranger").firestore();

    await assertSucceeds(getDoc(doc(aliceDb, "bookings/booking1")));
    await assertSucceeds(getDoc(doc(bobDb, "bookings/booking1")));
    await assertFails(getDoc(doc(strangerDb, "bookings/booking1")));
    await assertFails(
      updateDoc(doc(bobDb, "bookings/booking1"), {
        status: "cancelled",
      })
    );
    await assertFails(
      setDoc(doc(bobDb, "bookings/booking2"), {
        courtId: "activeCourt",
        userId: "bob",
      })
    );
  });

  it("restricts conversations and denies client-created messages", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const strangerDb = testEnv.authenticatedContext("stranger").firestore();

    await assertSucceeds(getDoc(doc(aliceDb, "conversations/booking_booking1")));
    await assertFails(getDoc(doc(strangerDb, "conversations/booking_booking1")));
    await assertSucceeds(
      updateDoc(doc(aliceDb, "conversations/booking_booking1"), {
        unreadBy: [],
      })
    );
    await assertFails(
      updateDoc(doc(aliceDb, "conversations/booking_booking1"), {
        bookingId: "other",
      })
    );
    await assertFails(
      setDoc(doc(aliceDb, "conversations/booking_booking1/messages/new"), {
        senderId: "alice",
        body: "Hello",
      })
    );
  });

  it("allows review reads but denies client review writes", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(getDoc(doc(anonDb, "reviews/booking1_player")));
    await assertFails(
      setDoc(doc(bobDb, "reviews/booking1_owner"), {
        bookingId: "booking1",
        rating: 5,
      })
    );
  });

  it("allows active-court list query for anyone, blocks unfiltered list for unauthenticated", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(
      getDocs(query(collection(anonDb, "courts"), where("bookableStatus", "==", "active")))
    );
    await assertFails(
      getDocs(collection(anonDb, "courts"))
    );
    await assertSucceeds(
      getDocs(collection(bobDb, "courts"))
    );
  });

  it("allows booking list queries scoped to own userId or ownerId, blocks cross-user queries", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const bobDb = testEnv.authenticatedContext("bob").firestore();

    await assertSucceeds(
      getDocs(query(collection(bobDb, "bookings"), where("userId", "==", "bob")))
    );
    await assertFails(
      getDocs(query(collection(bobDb, "bookings"), where("userId", "==", "alice")))
    );
    await assertSucceeds(
      getDocs(query(collection(aliceDb, "bookings"), where("ownerId", "==", "alice")))
    );
    await assertFails(
      getDocs(query(collection(bobDb, "bookings"), where("ownerId", "==", "alice")))
    );
  });

  it("allows participant to list messages, blocks stranger", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    const strangerDb = testEnv.authenticatedContext("stranger").firestore();

    await assertSucceeds(
      getDocs(collection(aliceDb, "conversations/booking_booking1/messages"))
    );
    await assertFails(
      getDocs(collection(strangerDb, "conversations/booking_booking1/messages"))
    );
  });

  it("denies all client access to audit logs and slot locks", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();

    await assertFails(getDoc(doc(aliceDb, "bookingSlotLocks/lock1")));
    await assertFails(
      setDoc(doc(aliceDb, "bookingSlotLocks/lock2"), {
        bookingId: "booking1",
      })
    );
    await assertFails(getDoc(doc(aliceDb, "securityAuditLogs/log1")));
    await assertFails(
      setDoc(doc(aliceDb, "securityAuditLogs/log2"), {
        eventType: "manual",
      })
    );
  });
});

describe("Storage rules", () => {
  it("allows owner image uploads under owner-scoped paths", async () => {
    const storage = testEnv.authenticatedContext("alice").storage();

    await assertSucceeds(
      uploadBytes(
        ref(storage, "users/alice/avatar.jpg"),
        new Blob(["image"], { type: "image/jpeg" })
      )
    );
    await assertSucceeds(
      uploadBytes(
        ref(storage, "courts/alice/court.webp"),
        new Blob(["image"], { type: "image/webp" })
      )
    );
  });

  it("denies cross-user writes, unsupported file types, and oversized images", async () => {
    const storage = testEnv.authenticatedContext("alice").storage();

    await assertFails(
      uploadBytes(
        ref(storage, "users/bob/avatar.jpg"),
        new Blob(["image"], { type: "image/jpeg" })
      )
    );
    await assertFails(
      uploadBytes(
        ref(storage, "users/alice/avatar.svg"),
        new Blob(["<svg />"], { type: "image/svg+xml" })
      )
    );
    await assertFails(
      uploadBytes(
        ref(storage, "courts/alice/large.png"),
        new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], {
          type: "image/png",
        })
      )
    );
  });
});
