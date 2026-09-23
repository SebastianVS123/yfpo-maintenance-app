# Maintenance Job Card App - Ready to Deploy

**Built in Arena Chat - No Terminal Needed for Deploy**

Stack: Next.js + Firebase (Auth + Firestore) + Cloudinary (photos) - All FREE, no billing card

## What You Have

This folder `maintenance-jobcard-app` is your complete app. It:
- Manager creates jobs (what, where, when, actions, departments, priority, photos, assigns to people)
- Operator gets email link, creates password first time, sees assigned jobs, starts job (auto), adds plan, completes with photo
- Works on phone + desktop, fully responsive
- Ready to migrate to local company server later (one file swap)

## Files

- `src/` - App code (already built, no need to edit)
- `.env.example` - Shows what keys you need
- `package.json` - Dependencies
- `vercel.json` - For cron (overdue checks)

## Deploy - 4 Steps, No Terminal, Just Copy-Paste

You did Render + Supabase + GitHub before - same flow.

### 1. Firebase (10 min)

- https://console.firebase.google.com → Add Project → `maintenance-app` → No Analytics → Create
- Top search bar → Type `Authentication` → Get Started → Sign-in method → Email/Password → Enable → Save
- Top search → Type `Firestore` → Create database → `europe-west3` → Test mode → Create
- Gear ⚙️ → Project Settings → General → Web icon `</>` → Nickname `web` → Register → Copy 6 values
- Same Settings → Service accounts → Generate private key → Download JSON → Copy 3 values (project_id, client_email, private_key)

### 2. Cloudinary (3 min)

- https://cloudinary.com → Sign Up Free (no card) → Dashboard → Copy Cloud name, API Key, API Secret

### 3. GitHub (5 min, No Terminal)

- Download `maintenance-app-MAC-FIXED.zip` from Arena → On Mac double-click to unzip (if fails, use tar.gz or tell me repo URL and I push for you)
- https://github.com → New repo → `maintenance-app` → Public → Create → Click `uploading an existing file` → Drag ALL files from unzipped folder → Commit

**No zip working?** Create empty repo, paste URL here, I push code for you from Arena.

### 4. Render (10 min, No Terminal)

- https://render.com → Sign Up with GitHub → New + → Web Service → Connect `maintenance-app` repo
- Build: `npm install && npm run build` | Start: `npm start`
- Environment Variables → Add:

```
NEXT_PUBLIC_FIREBASE_API_KEY= apiKey
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN= authDomain
NEXT_PUBLIC_FIREBASE_PROJECT_ID= projectId
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET= storageBucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID= messagingSenderId
NEXT_PUBLIC_FIREBASE_APP_ID= appId
FIREBASE_PROJECT_ID= project_id
FIREBASE_CLIENT_EMAIL= client_email
FIREBASE_PRIVATE_KEY= "-----BEGIN PRIVATE KEY-----\n...private_key...\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME= cloud name
CLOUDINARY_API_KEY= api key
CLOUDINARY_API_SECRET= api secret
NEXT_PUBLIC_APP_URL= https://maintenance-app.onrender.com (update after first deploy)
CRON_SECRET= my-secret-123
RESEND_FROM_EMAIL= onboarding@resend.dev
```

- Create Web Service → Live URL → Copy URL → Edit NEXT_PUBLIC_APP_URL → Paste live URL → Save → Redeploy
- Firebase → Authentication → Settings → Authorized domains → Add domain → Paste `maintenance-app.onrender.com`

Done! Live!

## For Tomorrow

Everything is sorted, clean, builds. One README only. No extra guides.

When you return:
1. Tell me if you have Firebase + Cloudinary keys
2. Tell me GitHub repo URL (or if zip still fails, I push for you)
3. I help you deploy to Render in 10 min

No rambling, just copy-paste.
