import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// 환경 변수로 Firebase 설정 분리 (VITE_ 접두사 필수)
// Cloudflare Pages: Settings → Environment variables 에서 설정
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            ?? 'YOUR_API_KEY',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        ?? 'YOUR_PROJECT.firebaseapp.com',
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       ?? 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? 'YOUR_PROJECT',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     ?? 'YOUR_PROJECT.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? 'YOUR_SENDER_ID',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             ?? 'YOUR_APP_ID',
};

let app: FirebaseApp;
let database: Database;

export function initFirebase(): Database {
  if (!database) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  }
  return database;
}

export function getDb(): Database {
  if (!database) throw new Error('Firebase not initialized. Call initFirebase() first.');
  return database;
}

export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY';
}
