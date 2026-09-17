# Maintenance Job Card System 🔧 — Firebase Edition (Free, No Project Limit)

A full-stack, **fully responsive** (mobile + desktop) web app for managing maintenance issues. Managers create job cards, assign to operators, operators start/complete jobs with photos, with email notifications and overdue tracking.

Built with **Next.js 15, Firebase (Auth + Firestore + Storage), Tailwind CSS, Resend**.

## Why Firebase Instead of Supabase?

You had 2 free Supabase projects limit. Firebase Spark (free) has:
- **No project limit**
- Auth: 50k MAU free
- Firestore: 50k reads / 20k writes per day free
- Storage: 5GB free
- Perfect for small maintenance teams (5-20 users)
- Real-time, mobile-friendly, scales cheaply ($0.06/100k reads after free)

## Features — Fully Responsive

### 📱 Mobile & Desktop UI
- **Mobile-first**: All pages work on phone (camera upload, tap-friendly, bottom sheets)
- Responsive headers with hamburger menu on mobile
- Job cards: stacked layout on mobile, side-by-side on desktop
- Forms: 16px font to prevent iOS zoom, large tap targets
- Tables: desktop table, mobile cards
- Photos: grid adapts 2 cols mobile → 3 cols desktop
- Works on: iPhone, Android, iPad, Desktop

### Manager / Admin
- Login → Admin dashboard with stats (total/open/in progress/completed/overdue) — responsive grid 3 cols mobile, 5 desktop
- See past issues: photo preview, status, when & to whom allocated
- **Create Job**: What, Where, When Seen, Required Actions, Departments (multi-select: Quality, Safety, Logistics, Production, Management), Priority, Due Date, Photos (multiple, camera on mobile), Allocate personnel (multi-select)
- **Personnel Management**: Add/edit roles, emails, department, active/inactive + "Add 5 Placeholders"
- Job detail with commits, photos, assignments
- Receives email on completion + OVERDUE

### Operator
- Receives email with priority VERY clearly (colored banner), breakdown, link
- Clicks link → sign in, first time creates password via signup → system matches email with personnel pre-created by admin (Firestore query)
- Without link: dashboard shows all allocated jobs, UNOPENED badge, priority
- Via link: auto-opens specific job after sign in and **starts job** (first open = start time)
- Provides estimated time + plan of action
- Multiple assignees see previous commits + start time, can contribute
- Completion: must upload completion photo (camera on mobile) + confirm

### System
- Email via Resend (assignment, completion, overdue)
- Overdue: both manager due date + estimated time heuristic (critical >4h, high >12h, medium >48h, low >7d)
- Firebase Storage for photos
- Role-based auth (manager, operator, admin)
- Firestore security rules (permissive for MVP, hardened example provided)

## Tech Stack
- Next.js 15 App Router (client components for Firebase)
- Firebase Auth, Firestore, Storage
- Tailwind CSS v4
- Resend for emails
- TypeScript

## Quick Start (Local)

1. **Clone & Install**
```bash
git clone <your-repo>
cd maintenance-jobcard-app
npm install
```

2. **Firebase Setup (see firebase-setup.md for in-depth)**
- Create project at https://console.firebase.google.com
- Enable Auth → Email/Password
- Create Firestore → Start in Test Mode → Location europe-west
- Enable Storage → Test Mode
- Project Settings → General → Web App → Copy config
- Project Settings → Service Accounts → Generate private key → Download JSON

3. **Env**
```bash
cp .env.example .env.local
# Fill values - see .env.example
```

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=maintenance@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=random-secret
```

4. **Run**
```bash
npm run dev
```

Open http://localhost:3000 → signup first user becomes manager.

## Firestore Collections

- `users` (id = Auth UID, email, full_name, role, created_at)
- `personnel` (email unique, full_name, role, department, is_active)
- `jobCards` (title, location, observed_at, required_actions, departments[], priority, status, created_by, createdByName, etc)
- `jobPhotos` (job_id, url, type issue/completion)
- `jobAssignments` (job_id, personnel_id, profile_id, status unopened/opened/started/completed)
- `jobCommits` (job_id, user_id, userName, message, estimated_time, type)

No SQL needed - collections auto-create on first write.

## Deployment - Go Live (Firebase)

See `firebase-setup.md` for full in-depth steps.

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Firebase edition - mobile responsive"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maintenance-jobcard-app.git
git push -u origin main
```

### 2. Firebase Production Rules
- Firestore Rules → Paste secure rules from firebase-setup.md
- Storage Rules → Paste

### 3. Vercel Deploy
- Import GitHub repo
- Add env vars (all Firebase + Resend + APP_URL = https://your-app.vercel.app)
- Deploy
- After deploy: Firebase Console → Auth → Settings → Authorized domains → Add Vercel domain
- Update NEXT_PUBLIC_APP_URL to Vercel URL → Redeploy

### 4. Resend Domain
- Verify domain in Resend, update FROM email

### 5. Overdue Cron
- `vercel.json` has cron: `/api/check-overdue?secret=YOUR_SECRET` hourly
- Or use cron-job.org free calling that URL every 30 min

### 6. Test Flow
- Manager creates job → Operator gets email → Signup with same email → Dashboard → Start → Complete → Manager gets completion email

## Mobile Responsiveness Details

- **Headers**: Hamburger menu on < md, full buttons on desktop
- **Stats**: 3 cols on mobile, 5 on desktop
- **Job Cards**: Mobile = photo left + stacked info, Desktop = horizontal with more details
- **Forms**: Single col on mobile, 2 cols on desktop, 16px inputs to prevent zoom
- **Photos**: Camera capture attribute `capture="environment"` on completion
- **Personnel**: Desktop table, mobile cards
- **All buttons**: min 44px height for tap, large enough for thumbs

Tested on iPhone SE (375px) to 4K desktop.

## Email Templates
Same as before - priority badge very clearly, breakdown, link. Mocked if no RESEND_API_KEY.

## License
MIT
