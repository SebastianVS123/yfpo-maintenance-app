import * as admin from 'firebase-admin'

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (serviceAccountJson) {
    // If full JSON provided
    try {
      const serviceAccount = JSON.parse(serviceAccountJson)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      })
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY', e)
    }
  } else if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    })
  } else {
    // Fallback for local dev without admin (will fail for admin ops, but client still works)
    console.warn('Firebase Admin not fully configured - missing service account env vars')
    if (projectId) {
      admin.initializeApp({
        projectId,
      })
    }
  }
}

export const adminAuth = admin.apps.length ? admin.auth() : null
export const adminDb = admin.apps.length ? admin.firestore() : null
export const adminStorage = admin.apps.length ? admin.storage() : null

export default admin
