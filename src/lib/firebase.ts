// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDXVS2ajFmM4Fpn9nhuWSzOFW-9LbrElMQ",
  authDomain: "courtshare-2316d.firebaseapp.com",
  projectId: "courtshare-2316d",
  storageBucket: "courtshare-2316d.appspot.com",
  messagingSenderId: "241080780719",
  appId: "1:241080780719:web:515b4cdce43837f0060cce",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
