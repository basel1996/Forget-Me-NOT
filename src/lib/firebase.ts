import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, signInWithPopup as firebaseSignInWithPopup, onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, serverTimestamp as firestoreServerTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

if (!firebaseConfig.apiKey) {
  console.warn("Firebase API Key is missing. Ensure you have set VITE_FIREBASE_API_KEY in your .env file or Settings.");
}

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver
});
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  ignoreUndefinedProperties: true,
});

export const googleProvider = new GoogleAuthProvider();

export const signInWithPopup = () => firebaseSignInWithPopup(auth, googleProvider);
export const onAuthStateChanged = (authInstance: any, callback: (user: any) => void) => {
  return firebaseOnAuthStateChanged(authInstance, (user) => {
    callback(user);
  });
};

export const serverTimestamp = firestoreServerTimestamp;
export type { User } from 'firebase/auth';
