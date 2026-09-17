# 🚀 Step-by-Step Go Live Guide

## Prerequisites
- GitHub account
- Supabase account (free tier)
- Vercel account (free tier)
- Resend account (free tier, 100 emails/day)
- Domain (optional but recommended for emails)

---

## STEP 1: Supabase Backend Setup (10 minutes)

1. Go to https://supabase.com → New Project
   - Name: maintenance-jobcards
   - Region: closest to Pretoria (e.g. eu-west or your preference)
   - Set DB password

2. Wait for project to provision (~2 min)

3. Go to **SQL Editor** → New Query → Paste entire contents of `supabase-schema.sql` from repo root → Run

   This creates:
   - Tables: profiles, personnel, job_cards, job_photos, job_assignments, job_commits
   - Storage bucket: job-photos (public)
   - RLS policies (permissive for MVP)
   - Trigger: auto-match personnel on signup

4. **Auth Settings**:
   - Authentication → Providers → Email → Enable (should be enabled)
   - Disable "Confirm email" for easier testing OR keep enabled for production (users get confirmation email)
   - Authentication → URL Configuration:
     - Site URL: `http://localhost:3000` for now, later change to Vercel URL
     - Additional Redirect URLs: add `http://localhost:3000/auth/callback` and later `https://YOUR_APP.vercel.app/auth/callback`

5. **Storage Check**:
   - Storage → Buckets → Should see `job-photos` public
   - If not, create it manually: New Bucket → Name `job-photos` → Public = true

6. **Get API Keys**:
   - Project Settings → API
   - Copy:
     - Project URL: `https://xxxx.supabase.co`
     - Anon Public Key
     - Service Role Key (secret, keep safe)

---

## STEP 2: Resend Email Setup (5 minutes)

1. Go to https://resend.com → Sign Up
2. **For Testing (no domain)**:
   - You can use `onboarding@resend.dev` as FROM email
   - But it ONLY sends to your own Resend account email
   - Good for initial test
3. **For Production (recommended)**:
   - Domains → Add Domain → e.g. `yourdomain.com`
   - Add DNS records Resend shows (SPF, DKIM) to your DNS provider
   - Wait for verification
   - Then FROM email can be `maintenance@yourdomain.com`
4. **Get API Key**:
   - API Keys → Create → Copy `re_...`

---

## STEP 3: Local Test (5 minutes)

```bash
cd maintenance-jobcard-app
npm install
cp .env.example .env.local
```

Fill `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=my-secret-123
```

```bash
npm run dev
```

- Open http://localhost:3000 → redirects to /auth/login
- Go to /auth/signup → Create first account (becomes manager automatically since personnel table empty)
- Login → Admin Dashboard → Personnel → Add 5 Placeholders → Add real personnel
- Create Job → Assign to placeholder emails
- Check console for mocked emails if Resend not configured
- Test operator signup with same placeholder email

---

## STEP 4: Push to GitHub

```bash
git init
git add .
git commit -m "Initial: maintenance job card system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maintenance-jobcard-app.git
git push -u origin main
```

Create repo on GitHub first if not exists.

---

## STEP 5: Deploy to Vercel (5 minutes)

1. Go to https://vercel.com → New Project → Import GitHub repo `maintenance-jobcard-app`
2. Framework: Next.js (auto-detected)
3. **Environment Variables** → Add all:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   RESEND_API_KEY
   RESEND_FROM_EMAIL (use verified domain if available)
   NEXT_PUBLIC_APP_URL = https://YOUR_APP.vercel.app (will be known after first deploy, you can update later)
   CRON_SECRET = random string e.g. openssl rand -hex 32
   ```
4. Deploy → Wait ~2 min
5. Once deployed, copy Vercel URL (e.g. `https://maintenance-jobcard-app-xxx.vercel.app`)
6. Go back to Vercel → Settings → Environment Variables → Update `NEXT_PUBLIC_APP_URL` to actual Vercel URL → Redeploy

---

## STEP 6: Update Supabase URLs for Production

- Supabase → Authentication → URL Configuration:
  - Site URL: `https://YOUR_APP.vercel.app`
  - Additional Redirect URLs:
    - `https://YOUR_APP.vercel.app/auth/callback`
    - `https://YOUR_APP.vercel.app/*`

---

## STEP 7: Overdue Cron

**Option A: Vercel Cron (Easiest, already configured)**

`vercel.json` in repo:
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

- Vercel automatically runs this every hour
- Must be on Vercel Pro for cron? Free tier allows daily cron only. If free, change schedule to `0 0 * * *` (daily) or use Option B.

**Option B: cron-job.org (Free)**

- Go to https://cron-job.org → Create account
- Create new cron job:
  - URL: `https://YOUR_APP.vercel.app/api/check-overdue?secret=YOUR_CRON_SECRET`
  - Schedule: Every 30 minutes
  - Enable

**Option C: Manual**

Call the endpoint manually or via GitHub Actions.

Test it:
```bash
curl https://YOUR_APP.vercel.app/api/check-overdue?secret=YOUR_CRON_SECRET
```

Should return JSON with overdueFound.

---

## STEP 8: First Real Use

1. Go to `https://YOUR_APP.vercel.app/auth/signup` → Create manager account
2. Login → Admin → Personnel → Add your real team (name, email, role operator)
3. Create Job → Assign → They get email with:
   - Priority badge VERY clearly (colored banner)
   - Breakdown: What, Where, When, Actions, Departments
   - Link to job card
4. Operator clicks link → If first time, redirected to signup? Actually login page has link to signup with `next` param preserved. They signup using SAME email as you added in personnel. System matches automatically (trigger + manual linking).
5. Operator logs in → Dashboard shows UNOPENED badge → Clicks job → Auto marks as STARTED (admin sees started) → First open time = job start time
6. Operator adds Estimated Time + Plan of Action → Other assignees see previous commits
7. Operator uploads completion photo + confirm → Job completed → Email sent to issuer (you)

---

## STEP 9: Custom Domain (Optional)

- Vercel → Settings → Domains → Add your domain
- Update DNS
- Update `NEXT_PUBLIC_APP_URL` env var to custom domain
- Update Supabase URL config to custom domain

---

## Troubleshooting

- **Emails not sending**: Check Resend logs, verify FROM domain, check that recipient email is allowed if using onboarding@resend.dev
- **Photos not uploading**: Check Supabase Storage bucket public, RLS policies
- **Signup says not registered**: Manager must add personnel first in /admin/personnel with exact email
- **Job not starting on link click**: Check middleware, ensure user is assigned, check job_assignments table
- **Overdue not triggering**: Check due_date set, or critical jobs >4h heuristic, call API manually to test

---

## Security Hardening (After MVP)

- Tighten RLS policies: only allow managers to create jobs, operators to see assigned only
- Add role check in API routes
- Add rate limiting
- Use Supabase Auth email templates customization

---

## Done!

Your app is live at `https://YOUR_APP.vercel.app`

Manager login: /auth/login
Operator first time: /auth/signup (must match personnel email)

Enjoy!
