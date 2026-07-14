import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Use environment variables if available (e.g. on Vercel), fallback to the JSON configuration file
const metaEnv = (import.meta as any).env || {};
const apiKey = metaEnv.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey;
const authDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain;
const projectId = metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId;
const storageBucket = metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket;
const messagingSenderId = metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId;
const appId = metaEnv.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId;
const measurementId = metaEnv.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId;
const firestoreDatabaseId = metaEnv.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId;

const app = getApps().length === 0 ? initializeApp({
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId
}) : getApp();

// If a custom firestoreDatabaseId is provided, we pass it to getFirestore to target the correct database
const db = getFirestore(
  app,
  firestoreDatabaseId || '(default)'
);

// Initialize Firebase Storage
const storage = getStorage(app);

export { app, db, storage };
