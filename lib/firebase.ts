import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { analyticsAllowed } from './consent';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, 'us-central1');
const storage = getStorage(app);

// Analytics is a NON-ESSENTIAL cookie. It must not initialize until the visitor
// has explicitly accepted cookies (see lib/consent.ts). The consent banner calls
// enableAnalytics() on accept; on later visits we auto-init if consent persists.
let analytics: Analytics | undefined;

export function enableAnalytics(): void {
  if (typeof window === 'undefined') return;
  if (analytics) return; // already running
  if (!analyticsAllowed()) return; // no consent → stay off
  isSupported().then((supported) => {
    if (supported && analyticsAllowed()) {
      analytics = getAnalytics(app);
    }
  });
}

// Auto-init on load only when consent was previously granted.
if (typeof window !== 'undefined' && analyticsAllowed()) {
  enableAnalytics();
}

export { app, db, auth, functions, storage, analytics };
