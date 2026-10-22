import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyABf5BCYu2tFI8kcPMdri1rP8eI7UjamFY",
  authDomain: "woki-toki-69a0d.firebaseapp.com",
  projectId: "woki-toki-69a0d",
  storageBucket: "woki-toki-69a0d.firebasestorage.app",
  messagingSenderId: "482808339600",
  appId: "1:482808339600:web:ff5a9281f6201ca1bfcc15",
  measurementId: "G-XC6RR04FKP",
  databaseURL: "https://woki-toki-69a0d-default-rtdb.firebaseio.com"
};

// Initialize Firebase
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
