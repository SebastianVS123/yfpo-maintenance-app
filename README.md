# Maintenance Job Card System 🔧

A full-stack web app for managing maintenance issues - managers create job cards, assign to operators, operators start/complete jobs with photos, with email notifications and overdue tracking.

Built with **Next.js 15, Supabase, Tailwind CSS, Resend**.

## Features

### Manager / Admin
- Login and land on admin dashboard
- See past issues: status, preview photo, when and to whom allocated
- **Create Job**: What, Where, When Seen, Required Actions, Departments (multi-select: Quality, Safety, Logistics, Production, Management), Priority, Due Date, Photos (multiple), Allocate to personnel (multi-select)
- **Personnel Management**: Add/edit roles and emails, placeholder names, active/inactive toggle. Saved and matched on operator signup
- Job detail view with all commits, photos, assignments
- Receives email on job completion
- Receives OVERDUE email

### Operator / Technician
- Receives email with breakdown, priority very clearly, link to specific job card
- Clicks link → must sign in with email + password they create first time (invite-match logic: email must be pre-registered by admin, then allowed to create account, saved and matched)
- Without link: sees job view dashboard with all allocated jobs, priority, unopened badge
- Via link: auto-opens specific job card after sign in and **starts job** (admin sees started)
- First opening: provides estimated job time + brief plan of action in job card
- If multiple assigned: sees previous commits by other operators + first initial open date = job start time, can contribute to plan
- Upon completion: must upload completion photo + confirm before submitting
- Triggers return email to issuer

### System
- Email via Resend (assignment, completion, overdue)
- Overdue logic: both manager due date + estimated time heuristic (critical >4h, high >12h, medium >48h, low >7 days)
- Supabase storage for photos (job-photos bucket)
- Role-based auth (manager, operator, admin)
- RLS policies (open for MVP, tighten later)

## Tech Stack
- Next.js 15 App Router
- Supabase (Auth, Postgres, Storage)
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

2. **Supabase Setup**
- Create project at https://supabase.com
- Go to SQL Editor, run `supabase-schema.sql` (in repo root)
- Enable Email Auth in Authentication → Providers
- Create storage bucket `job-photos` public (SQL already does, but check)
- Copy URL, Anon Key, Service Role Key from Project Settings → API

3. **Resend Setup**
- Create account at https://resend.com
- Verify domain or use `onboarding@resend.dev` for testing (only sends to your own email)
- Get API Key
- Set `RESEND_FROM_EMAIL` to your verified domain email or `onboarding@resend.dev`

4. **Env**
```bash
cp .env.example .env.local
# Fill values
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=maintenance@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=some-random-secret-for-overdue-cron
```

5. **Run**
```bash
npm run dev
```

Open http://localhost:3000 → redirects to login → Sign up first user becomes manager.

## Supabase Schema Details

See `supabase-schema.sql`:

- `profiles` (id FK auth.users, email, full_name, role)
- `personnel` (id, email unique, full_name, role, department, is_active, created_by) - pre-created by admin
- `job_cards` (id, title, location, observed_at, required_actions, departments text[], priority, status, created_by, due_date, estimated_time, started_at, completed_at, etc)
- `job_photos` (job_id, url, type issue/completion)
- `job_assignments` (job_id, personnel_id, profile_id, status unopened/opened/started/completed, opened_at)
- `job_commits` (job_id, user_id, message, estimated_time, type plan/comment/status_update)

Trigger `handle_new_user()` auto-matches personnel email on signup.

## Deployment - Go Live Step by Step

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial maintenance job card app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maintenance-jobcard-app.git
git push -u origin main
```

### 2. Supabase Production
- Same SQL already run
- In Supabase Dashboard → Authentication → URL Configuration:
  - Site URL: `https://your-vercel-app.vercel.app`
  - Additional Redirect URLs: `https://your-vercel-app.vercel.app/auth/callback`
- Storage → job-photos → set public = true

### 3. Deploy to Vercel (recommended)
- Go to https://vercel.com → New Project → Import GitHub repo
- Framework preset: Next.js
- Add Environment Variables (same as .env.local but APP_URL = your vercel url):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `NEXT_PUBLIC_APP_URL` = `https://your-app.vercel.app`
  - `CRON_SECRET` = random string
- Deploy

### 4. Resend Domain (for production emails)
- In Resend → Domains → Add your domain
- Add DNS records (SPF, DKIM)
- Once verified, update `RESEND_FROM_EMAIL` to `maintenance@yourdomain.com` in Vercel env and redeploy
- Test email flow

### 5. Overdue Cron Setup
Option A - Vercel Cron:
Create `vercel.json` in root:

```json
{
  "crons": [
    {
      "path": "/api/check-overdue?secret=YOUR_CRON_SECRET",
      "schedule": "0 * * * *"
    }
  ]
}
```

Every hour checks overdue.

Option B - Supabase pg_cron + Edge Function (advanced)
Option C - Manual: Call `https://your-app.vercel.app/api/check-overdue?secret=xxx` via cron-job.org every hour

### 6. First Admin User
- After deploy, go to `https://your-app.vercel.app/auth/signup`
- Create account with your manager email → becomes manager
- Login → Go to Personnel → Add placeholder personnel or real team
- Then Create Job → Assign → Emails sent

### 7. Operator Flow Test
- As manager, create job assigned to `test@yourcompany.com` (add personnel first)
- Operator receives email (if Resend domain verified and email exists)
- Operator goes to signup, uses same email, creates password
- Logs in, sees dashboard with NEW badge
- Clicks job → auto starts → adds plan → completes with photo
- Manager gets completion email

## Email Templates
- Assignment: Shows priority badge very clearly (colored banner), breakdown, link to job, note about first-time password
- Completion: Green banner, who completed, when, link
- Overdue: Red banner, urgent, list assignees, due date

If `RESEND_API_KEY` missing, emails are mocked and logged to console (dev mode).

## Future Improvements
- Tighten RLS policies per role
- Push notifications
- Job comments with @mentions
- Analytics dashboard
- Export to PDF
- Mobile PWA

## License
MIT
