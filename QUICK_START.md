# QUICK START - For You Right Now

Your app code is ready in `/home/user/maintenance-jobcard-app` and git initialized.

## What I Built

✅ **Manager Flow:**
- Login → Admin Dashboard (stats: total/open/in progress/completed/overdue)
- See past issues with photo preview, status, when allocated, to whom
- Create Job button → Form: What, Where, When Seen, Required Actions, Departments (Quality, Safety, Logistics, Production, Management - multi-select), Priority, Due Date, Photos (multiple upload), Allocate to personnel (multi-select dropdown)
- Personnel Management button → Add/edit roles, emails, department, active/inactive + "Add 5 Placeholders" button
- Upon Confirm: Job lodged, emails sent

✅ **Email System (Resend):**
- Assignment email: Priority VERY clearly (big colored banner), breakdown/summary, link to specific job card
- Completion email: To issuer when operator finishes
- Overdue email: Red urgent banner, sent to assignees + issuer
- Mock mode if no RESEND_API_KEY (logs to console)

✅ **Operator Flow:**
- Email link → Sign in page with `next` param preserved
- First time: Creates password via /auth/signup → System matches email with personnel pre-created by admin (saved and matched)
- Without link: Operator dashboard shows all allocated jobs, priority, UNOPENED badge for new
- Via link: Auto-opens specific job after sign in and marks STARTED (admin sees started)
- First opening: Provides estimated job time + brief plan of action in job card itself
- Multiple assignees: See previous commits by others + first initial open date = job start time, can contribute to plan
- Completion: Must upload completion photo + confirm before submit

✅ **Overdue Logic (Both as requested):**
- Manager due date check + estimated time heuristic (critical >4h, high >12h, medium >48h, low >7d)
- Cron endpoint: /api/check-overdue?secret=XXX

## File Structure
```
src/
  app/
    page.tsx (auto redirect by role)
    auth/login, signup, callback
    admin/ (dashboard), admin/create-job, admin/personnel
    operator/ (dashboard)
    jobs/[id]/ (detail with auto-start logic, commits, completion)
    api/send-email, check-overdue, upload
  lib/
    supabase/client, server, middleware
    email.ts (Resend templates)
    utils.ts (priority/status config)
supabase-schema.sql (full DB + storage + triggers)
```

## To Go Live - 3 Steps

1. **Supabase**: Create project, run supabase-schema.sql in SQL Editor, copy URL + keys
2. **Resend**: Get API key, verify domain (or use onboarding@resend.dev for test)
3. **Vercel**: Import GitHub repo, add env vars, deploy

Full detailed steps in DEPLOYMENT.md

## Local Test Now

```bash
cd /home/user/maintenance-jobcard-app
npm install (already done but node_modules excluded from snapshot, run again if needed)
cp .env.example .env.local
# edit .env.local with your Supabase + Resend keys
npm run dev
```

Then:
- http://localhost:3000 → signup first user (becomes manager)
- Add personnel
- Create job
- Test operator flow

## GitHub Push

```bash
cd /home/user/maintenance-jobcard-app
git remote add origin https://github.com/YOUR_USERNAME/maintenance-jobcard-app.git
git push -u origin main
```

## Need Help?

All logic is commented, emails have beautiful HTML templates, and README has full feature list.

If you want me to add:
- PDF export of job cards
- WhatsApp notifications
- Mobile PWA
- tighter RLS

Just ask!
