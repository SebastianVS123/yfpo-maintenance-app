# 🔥 Firebase Setup - In Depth (Free Tier, No Project Limit)

Firebase Free (Spark) gives you:
- Auth: 50k MAU free
- Firestore: 50k reads, 20k writes, 20k deletes per day free
- Storage: 5GB, 1GB/day download
- Hosting: 10GB/month
- No limit on number of projects (unlike Supabase 2 free projects)

Perfect for your maintenance app.

## STEP 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add Project"
   - Name: `maintenance-jobcard` (or any)
   - Disable Google Analytics for simplicity (or enable)
   - Create Project (takes ~30 sec)

## STEP 2: Enable Authentication

1. Left sidebar → Build → Authentication
2. Click "Get Started"
3. Sign-in method tab → Enable:
   - Email/Password → Enable → Save
   - (Optional) Email link if you want magic link
4. Settings tab → Authorized domains → Add your Vercel domain later: `your-app.vercel.app`

## STEP 3: Create Firestore Database

1. Left sidebar → Build → Firestore Database
2. Click "Create Database"
3. Choose:
   - Location: `europe-west` or `us-central` (closest to Pretoria = europe-west)
   - Start in **Test Mode** for now (we'll add rules later)
4. Click Create

### Collections Structure (auto-created on first write, but you can create manually):

We use these collections:

**users** (profile, matches Auth)
```
id: string (same as Firebase Auth UID)
email: string
full_name: string
role: 'manager' | 'operator' | 'admin'
created_at: timestamp
```

**personnel** (pre-registered by manager)
```
id: auto
email: string (unique, lowercased)
full_name: string
role: string
department: string | null
is_active: boolean
created_by: string (UID)
created_at: timestamp
```

**jobCards**
```
id: auto
title: string
location: string
observed_at: timestamp
required_actions: string
departments: string[]
priority: 'low' | 'medium' | 'high' | 'critical'
status: 'open' | 'started' | 'in_progress' | 'completed' | 'overdue'
created_by: string (UID)
createdByName: string
createdByEmail: string
due_date: timestamp | null
estimated_time: string | null
started_at: timestamp | null
completed_at: timestamp | null
completion_notes: string | null
created_at: timestamp
updated_at: timestamp
```

**jobPhotos**
```
id: auto
job_id: string
url: string
type: 'issue' | 'completion'
file_name: string
uploaded_by: string
created_at: timestamp
```

**jobAssignments**
```
id: auto
job_id: string
personnel_id: string
profile_id: string | null (linked after signup)
status: 'unopened' | 'opened' | 'started' | 'completed'
opened_at: timestamp | null
created_at: timestamp
```

**jobCommits**
```
id: auto
job_id: string
user_id: string
userName: string
userEmail: string
message: string
estimated_time: string | null
type: 'plan' | 'comment' | 'status_update'
created_at: timestamp
```

You don't need to manually create them - code will create on first write.

## STEP 4: Enable Storage

1. Left sidebar → Build → Storage
2. Get Started → Start in Test Mode → Choose same location as Firestore
3. Create

### Storage Structure:
```
job-photos/
  {jobId}/
    {timestamp}-{filename}
    completion-{timestamp}-{filename}
```

## STEP 5: Get Firebase Config (Client)

1. Project Settings (gear icon top left) → General tab
2. Scroll to "Your apps" → Click Web icon `</>` 
3. Register app: Nickname `maintenance-web`, check Hosting optional
4. Copy config object:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123...",
  appId: "1:123:web:abc..."
};
```

These go into `.env.local` as `NEXT_PUBLIC_FIREBASE_...`

## STEP 6: Get Service Account (Admin SDK) - For Server Side

This is needed for `/api/check-overdue` and email APIs that need admin access.

1. Project Settings → Service Accounts tab
2. Click "Generate new private key" → Download JSON file
3. Open JSON file, you'll see:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com",
  ...
}
```

**Option A (Recommended for Vercel): Use 3 env vars**
- `FIREBASE_PROJECT_ID` = project_id from JSON
- `FIREBASE_CLIENT_EMAIL` = client_email from JSON
- `FIREBASE_PRIVATE_KEY` = private_key from JSON (keep \n as \n, wrap in quotes)

**Option B: Whole JSON as env var**
- Base64 encode the JSON or paste stringified JSON into `FIREBASE_SERVICE_ACCOUNT_KEY`

For local dev, you can use Option A.

## STEP 7: Firestore Security Rules

After testing, replace test mode rules with these secure rules:

Go to Firestore → Rules tab → Paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write for MVP
    // Tighten later per role
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Public read for personnel check during signup (needed before auth)
    // Actually we need to allow read of personnel by email before auth
    // So allow read if querying by email
    match /personnel/{id} {
      allow read: if true; // Needed for signup check
      allow write: if request.auth != null;
    }
  }
}
```

For production hardened:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    match /personnel/{id} {
      allow read: if true;
      allow create, update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['manager', 'admin'];
    }
    match /jobCards/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
    match /jobPhotos/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /jobAssignments/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /jobCommits/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

Click Publish.

## STEP 8: Storage Rules

Go to Storage → Rules tab:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /job-photos/{allPaths=**} {
      allow read: if true; // public read for photos in job cards
      allow write: if request.auth != null;
    }
  }
}
```

Publish.

## STEP 9: Environment Variables Setup

Create `.env.local` from `.env.example`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANB...\n-----END PRIVATE KEY-----\n"

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=maintenance@yourdomain.com

NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=random-32-char-string
```

## STEP 10: Test Locally

```bash
npm install
npm run dev
```

- Open http://localhost:3000 → redirects to login
- Signup first user → becomes manager (since personnel empty)
- Go to Personnel → Add placeholders → Create job → Assign
- Check Firebase Console → Firestore → Should see data appearing real-time

## STEP 11: Deploy to Vercel

1. Push to GitHub
2. Vercel → New Project → Import
3. Add same env vars (for private key, keep \n and wrap in quotes, or use Vercel's env var editor)
4. Deploy
5. Update:
   - `NEXT_PUBLIC_APP_URL` = your Vercel URL
   - Firebase Auth → Settings → Authorized domains → Add Vercel domain
6. Redeploy

## STEP 12: Overdue Cron

Same as before:
- `vercel.json` already has cron pointing to `/api/check-overdue?secret=YOUR_SECRET`
- Or use cron-job.org calling that URL every 30 min
- Needs Firebase Admin env vars to work

## Why Firebase vs Supabase?

- No 2-project limit on free tier
- More generous free reads/writes
- Real-time listeners built-in (we use getDocs for simplicity, but can upgrade to onSnapshot for live updates)
- Storage simpler
- Auth easier
- Scales to millions free tier enough for small maintenance teams

## Troubleshooting

- **Permission denied in Firestore**: Check rules, make sure you're authenticated, or set to test mode temporarily `allow read, write: if true;` (not for production)
- **Storage upload fails**: Check Storage rules, check bucket name matches env
- **Admin SDK fails**: Private key must have \n replaced correctly, ensure you used `replace(/\\n/g, '\n')` in code (we already do)
- **Personnel not matching on signup**: Email must be lowercased, exact match, check Firestore personnel collection has email field
- **Emails not sending**: Check Resend API key, FROM email verified, check Vercel logs

## Free Tier Limits to Watch

- Firestore: 50k reads/day = ~1k job card views/day (each view ~5 reads) - enough for 10-20 users
- If you exceed, upgrade to Blaze pay-as-you-go (still free tier included, then $0.06 per 100k reads - very cheap)
- Storage: 5GB free = ~5000 photos (1MB each)
- For maintenance team of 5-10 people, free tier lasts months

Done! You're now on Firebase, no Supabase limit.
