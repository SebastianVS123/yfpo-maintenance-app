import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123:web:abc',
}

let app: any
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
} catch (e) {
  console.warn('Firebase init failed (likely missing env during build), using mock')
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
}

export const auth = getAuth(app)
export const db = getFirestore(app)
// Storage removed - using Cloudinary now (no billing needed)
// export const storage = getStorage(app)

export default app
