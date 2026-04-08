import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// TODO: Firebase 콘솔에서 발급받은 설정값으로 교체하세요
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
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
