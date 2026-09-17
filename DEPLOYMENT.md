# 🚀 Deployment Guide - Firebase Edition (Free, No Limit)

## Why Firebase?

Supabase free = 2 projects max. Firebase Spark = unlimited projects, generous free tier:
- Auth 50k MAU free
- Firestore 50k reads/day free
- Storage 5GB free
- Perfect for maintenance team

## Step 1: Firebase Project Setup (In Depth - 15 min)

### 1.1 Create Project
1. https://console.firebase.google.com → Add Project
2. Name: `maintenance-jobcard`
3. Analytics: Disable (simpler) or Enable
4. Wait ~30 sec

### 1.2 Enable Auth
1. Build → Authentication → Get Started
2. Sign-in method → Email/Password → Enable → Save
3. Settings → Authorized domains → Will add Vercel domain later

### 1.3 Create Firestore
1. Build → Firestore Database → Create Database
2. Location: `europe-west3` (closest to Pretoria) or `us-central1`
3. Start in **Test Mode** (we'll secure later)
4. Create

Collections auto-create, but you can manually create for clarity:
- `users`
- `personnel`
- `jobCards`
- `jobPhotos`
- `jobAssignments`
- `jobCommits`

### 1.4 Enable Storage
1. Build → Storage → Get Started
2. Test Mode → Same location as Firestore → Done

### 1.5 Get Client Config
1. Project Settings (gear icon) → General
2. Your apps → Web `</>` → Register: `maintenance-web`
3. Copy config:
```js
apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
```
→ These are NEXT_PUBLIC_... env vars

### 1.6 Get Admin Service Account (for server)
1. Project Settings → Service Accounts → Generate new private key → Download JSON
2. JSON contains:
   - project_id
   - client_email
   - private_key
3. For Vercel env:
   - FIREBASE_PROJECT_ID = project_id
   - FIREBASE_CLIENT_EMAIL = client_email
   - FIREBASE_PRIVATE_KEY = private_key (keep \n, wrap in quotes: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n")

### 1.7 Security Rules (After Testing)

**Firestore Rules** (Firestore → Rules):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /personnel/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

For hardened production (manager only can create personnel):
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
    match /jobCards/{id} { allow read, write: if request.auth != null; }
    match /jobPhotos/{id} { allow read, write: if request.auth != null; }
    match /jobAssignments/{id} { allow read, write: if request.auth != null; }
    match /jobCommits/{id} { allow read, write: if request.auth != null; }
  }
}
```

**Storage Rules** (Storage → Rules):
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /job-photos/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Publish both.

## Step 2: Resend Email (5 min)

1. resend.com → Sign Up
2. For testing: use `onboarding@resend.dev` (only sends to your own email)
3. For production: Domains → Add Domain → Add DNS records → Verify → Use `maintenance@yourdomain.com`
4. API Keys → Create → Copy `re_...`

## Step 3: Local Test (5 min)

```bash
cd maintenance-jobcard-app
npm install
cp .env.example .env.local
# Fill env
npm run dev
```

Open http://localhost:3000 → Signup first user becomes manager → Add personnel → Create job

Check Firebase Console → Firestore → Data appears real-time

Test mobile responsiveness: Chrome DevTools → Toggle device toolbar → iPhone SE, iPad, Desktop

## Step 4: GitHub

```bash
git add .
git commit -m "Firebase edition - mobile responsive"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maintenance-jobcard-app.git
git push -u origin main
```

## Step 5: Vercel Deploy (5 min)

1. vercel.com → New Project → Import GitHub repo
2. Framework: Next.js
3. Env Vars:
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY (with \n, wrap in quotes)
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app (update after first deploy)
CRON_SECRET=random-32-chars
```
4. Deploy → Wait
5. Copy Vercel URL → Update NEXT_PUBLIC_APP_URL env var to that URL → Redeploy
6. Firebase Console → Auth → Settings → Authorized domains → Add Vercel domain (e.g. `your-app.vercel.app`)

## Step 6: Overdue Cron

**Option A: Vercel Cron (Pro plan needed for hourly, free = daily)**
`vercel.json` already:
```json
{
  "crons": [{
    "path": "/api/check-overdue?secret=YOUR_SECRET",
    "schedule": "0 * * * *"
  }]
}
```

**Option B: cron-job.org (Free, Recommended)**
- cron-job.org → Create account → New Cron Job
- URL: `https://your-app.vercel.app/api/check-overdue?secret=YOUR_SECRET`
- Schedule: Every 30 minutes
- Save

Test: `curl https://your-app.vercel.app/api/check-overdue?secret=YOUR_SECRET` → Should return overdueFound

## Step 7: Custom Domain (Optional)

- Vercel → Settings → Domains → Add domain → Update DNS
- Update NEXT_PUBLIC_APP_URL to custom domain → Redeploy
- Firebase Auth → Authorized domains → Add custom domain

## Step 8: First Real Use

1. https://your-app.vercel.app/auth/signup → Create manager
2. Login → Admin → Personnel → Add team
3. Create Job → Assign → They get email (if Resend verified)
4. Operator clicks link → Signup with same email → Dashboard → Start → Complete → You get email

## Troubleshooting

- **Firebase: permission denied**: Check Firestore rules, set to `allow read, write: if true;` temporarily for testing
- **Auth/invalid-api-key**: Check NEXT_PUBLIC_FIREBASE_API_KEY env var, ensure no quotes
- **Storage upload fails**: Check Storage rules, bucket name
- **Admin SDK fails**: Private key must have `\n` literally, code does `replace(/\\n/g, '\n')`, ensure you wrapped in quotes in Vercel
- **Personnel not matching**: Email lowercased exact match, check Firestore personnel collection
- **Mobile UI broken**: Clear cache, check Tailwind v4 loaded, viewport meta present
- **Emails not sending**: Check Resend logs, FROM verified, recipient allowed if using onboarding@resend.dev

## Mobile Responsiveness Checklist

We implemented:
- ✅ Hamburger menu on <768px
- ✅ Stats grid 3 cols mobile, 5 desktop
- ✅ Job cards stacked mobile, horizontal desktop
- ✅ Forms single col mobile, 2 col desktop
- ✅ 16px inputs to prevent iOS zoom
- ✅ Camera capture on completion photo
- ✅ Tables → cards on mobile
- ✅ Tap targets min 44px
- ✅ No horizontal scroll

Test on real phone: Open Vercel URL on phone, test create job, upload photo from camera, complete job.

Done! Live at https://your-app.vercel.app — Firebase free, no Supabase limit, mobile + desktop perfect.
