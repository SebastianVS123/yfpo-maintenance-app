# STEP 2 Explained Super Simple — Firebase Auth + Why It Matters

You said Step 2 is confusing. This is the most important step, so let's go **click-by-click** with screenshots described.

There are actually **TWO Step 2s** that confuse people:
1. **Firebase Step 2: Enable Authentication** (so users can log in)
2. **Deployment Step 2: Resend Email** (so job assignment emails work)

I'll explain both like you're doing it for the first time.

---

## PART A: Firebase Authentication (The Login System)

### What is this?
This is what lets your managers and operators create accounts and log in with email + password. Without this, NO ONE can log into your app.

### Why do we need it?
Your app has this flow:
- Manager adds personnel email in Personnel Management (e.g. `john@company.com`)
- John gets email with job link
- John clicks link → Must sign in
- First time, John creates password using SAME email
- System checks: "Is john@company.com in personnel collection?" → Yes → Allow signup + link his jobs

That check needs Firebase Auth to be ON.

### EXACT CLICKS - Do this now:

**1. Open Firebase Console**
- Go to: https://console.firebase.google.com
- You should see your project `maintenance-jobcard` (or whatever you named it)
- Click on it to enter

**2. Find Authentication in left menu**
- On left sidebar, look for "Build" section
- Under Build, you'll see:
  - Firestore Database
  - Realtime Database
  - Storage
  - **Authentication** ← Click this
  - Hosting
- Click **Authentication**

**3. First time screen**
- You'll see a big blue button "Get Started" in the middle
- Click **Get Started**

**4. Enable Email/Password**
- Now you're on "Sign-in method" tab at top
- You'll see a list of providers: Email/Password, Google, Facebook, etc.
- Find **Email/Password** row
- Click on it (click the pencil icon or the row itself)
- A popup appears with 2 toggles:
  - **Email/Password** → Toggle ON (it should turn blue/green)
  - **Email link (passwordless sign-in)** → Leave OFF (we don't need this)
- Click **Save**

**5. You should now see:**
- In the list, Email/Password should say "Enabled" with a green check
- That's it! Auth is enabled.

**6. IMPORTANT: Authorized Domains (Do this later after Vercel deploy, but understand now)**
- In Authentication, top tabs: Users | Sign-in method | **Settings** | Usage
- Click **Settings** tab
- Scroll to "Authorized domains"
- You'll see `localhost` and `your-project.firebaseapp.com` already there
- Later when you deploy to Vercel (e.g. `maintenance-app.vercel.app`), you MUST add it here:
  - Click "Add domain" → Type `maintenance-app.vercel.app` → Add
  - If you don't do this, login will fail on your live site with "auth/unauthorized-domain" error

**7. What about Users tab?**
- Click "Users" tab at top in Authentication
- Initially empty. After you signup first user in your app (http://localhost:3000/auth/signup), you'll see them appear here
- Each user has UID (unique ID like `abc123xyz`), email, creation date
- This UID is what we use to link to Firestore `users` collection

### Common Confusion & Fixes:

**Q: Do I need to create users manually in Firebase Console?**
A: NO! Your app creates them automatically when someone signs up at `/auth/signup`. Don't manually add users in console, it won't create Firestore profile.

**Q: What's the difference between Firebase Auth Users and Firestore `personnel` and `users` collections?**
- **Firebase Auth Users**: The actual login account (email + password) - managed by Firebase, you see in Authentication → Users tab
- **Firestore `personnel`**: Pre-registered list by manager (e.g. John, Sarah) - BEFORE they have login. This is what manager adds in Personnel Management page. It's just a list, not login yet.
- **Firestore `users`**: Profile that matches Auth UID + personnel info - created AUTOMATICALLY when someone signs up. Contains role (manager/operator), full_name, etc.

Flow:
```
Manager adds personnel: john@company.com (in Firestore personnel) 
→ John signs up with john@company.com (creates Firebase Auth user) 
→ Code checks personnel collection, finds match 
→ Creates Firestore users doc with same UID + role from personnel 
→ Links jobAssignments where personnel_id = John's personnel doc → profile_id = John's UID
→ Now John can see his jobs
```

**Q: I enabled Email/Password but signup says "auth/invalid-api-key"**
A: Your `.env.local` has wrong or missing `NEXT_PUBLIC_FIREBASE_API_KEY`. Go to Project Settings → General → Your apps → Web app → Config → Copy apiKey correctly. No spaces, no quotes.

**Q: Signup says "This email is not registered"?**
A: That's our custom logic! It means you tried to signup with email that manager did NOT pre-add in Personnel Management. For first user ever (when personnel collection empty), we allow anyone to become manager. After that, only pre-added emails can signup. So manager must add personnel first.

---

## PART B: Resend Email Setup (For Job Assignment Emails)

### What is this?
When manager creates job and assigns to John and Sarah, system must send email to them with job details, priority banner, and link. Firebase does NOT send emails itself, so we use Resend (free, easy).

### Why do we need it?
Without Resend:
- Job still gets created in Firestore
- But operators WON'T get email notification
- They won't know they have new job unless they check dashboard
- Code will log "[EMAIL MOCK] Would send email" in console (dev mode)

With Resend:
- Real email sent with beautiful template
- Priority VERY clearly visible
- Link to job card

### EXACT CLICKS - Free Tier:

**Option 1: Quick Testing (No Domain Needed) - 2 minutes**

1. Go to https://resend.com → Sign Up (use same email as your Firebase project owner)
2. Verify your email (check inbox)
3. You'll land on Dashboard
4. Left sidebar → API Keys → Create API Key
   - Name: `maintenance-app`
   - Permission: Sending access
   - Click Create → Copy the key `re_...` (starts with re_) → Save it somewhere safe, you only see it once!
5. Left sidebar → Domains → You'll see you have NO domain, but you CAN use `onboarding@resend.dev` as FROM email for testing
   - **Limitation**: When using `onboarding@resend.dev`, you can ONLY send emails to YOUR OWN email (the one you used to signup to Resend)
   - So for testing: Add personnel with YOUR OWN email (e.g. your gmail), then create job assigned to yourself, you'll get email
   - For real team, you need Option 2

6. Put in `.env.local`:
```
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Option 2: Production (With Your Domain) - 10 minutes + DNS**

This lets you send to ANY email (john@company.com, etc.)

1. In Resend Dashboard → Domains → Add Domain
2. Type your domain: e.g. `yourdomain.com` or subdomain `mail.yourdomain.com` (subdomain recommended)
3. Resend will show you 3 DNS records to add:
   - SPF: TXT record
   - DKIM: TXT record
   - (Optional) DMARC
4. Go to your domain registrar (e.g. GoDaddy, Namecheap, Cloudflare, etc.)
   - Find DNS management → Add TXT records exactly as Resend shows
   - Example:
     ```
     Type: TXT
     Name: @ or resend._domainkey
     Value: v=spf1 include:amazonses.com ~all
     ```
   - Copy-paste exactly, no extra spaces
5. Wait 5 min to 2 hours for DNS to propagate (Resend will auto-check, shows "Verified" green when done)
6. Once verified, you can use ANY from email on that domain:
```
RESEND_FROM_EMAIL=maintenance@yourdomain.com
# or
RESEND_FROM_EMAIL=noreply@yourdomain.com
```
7. Use that in env.

**How to test if email works:**

1. Set env vars correctly
2. Restart dev server: `npm run dev` (must restart after env change)
3. Login as manager → Personnel → Add personnel with email `test@yourdomain.com` (or your own email if using onboarding@resend.dev)
4. Create Job → Assign to that email → Confirm
5. Check:
   - Browser console? If you see "[EMAIL MOCK]", Resend key missing
   - Vercel logs or terminal? Should say email sent
   - Inbox of assigned email? Check spam folder!
   - Resend Dashboard → Logs → Should show email sent, delivered, or bounced

**Common Email Fixes:**

- **No email received, no error**: Check Resend Dashboard → Logs → Did it send? If status "delivered" but not in inbox, check spam. If "bounced", email invalid.
- **Error: "You can only send to your own email when using onboarding@resend.dev"**: You're using onboarding@resend.dev but trying to send to john@company.com. Solution: Either add personnel with YOUR Resend account email for testing, or verify your own domain (Option 2).
- **Error: "Domain not verified"**: You set FROM to maintenance@yourdomain.com but domain not verified in Resend. Verify domain or use onboarding@resend.dev for now.
- **Env var not working on Vercel**: After adding env vars in Vercel, you MUST redeploy (Vercel → Deployments → Redeploy). Env vars only apply on new deploy.

---

## VISUAL SUMMARY: How Auth + Personnel + Jobs Connect

```
[Firebase Auth]
  - Handles login
  - Stores email + password
  - Gives UID

[Firestore personnel collection]
  - Manager creates BEFORE operator signs up
  - Example: { email: "john@company.com", full_name: "John", role: "operator" }

[User signs up at /auth/signup with john@company.com]
  ↓
[Code checks: Does personnel with email john@company.com exist?]
  ↓ YES
[Create Firebase Auth user + Firestore users doc with same UID + role from personnel]
  ↓
[Find all jobAssignments where personnel_id = John's personnel doc ID]
  ↓
[Update those assignments: profile_id = John's UID]
  ↓
[Now when John logs in and goes to /operator, query jobAssignments where personnel_id=John OR profile_id=John's UID → Shows his jobs]

[Job Creation]
  Manager creates jobCards doc
  + jobPhotos docs (upload to Firebase Storage)
  + jobAssignments docs (one per assignee, status=unopened)
  + Call /api/send-email → Resend sends email with link https://your-app.vercel.app/jobs/{jobId}
```

---

## QUICK CHECKLIST FOR STEP 2:

**Firebase Auth:**
- [ ] Went to console.firebase.google.com → Your project → Authentication → Get Started
- [ ] Enabled Email/Password → Saved → Shows Enabled
- [ ] Understood difference between Auth Users vs personnel vs users collections
- [ ] Know that first signup becomes manager automatically if personnel empty

**Resend Email:**
- [ ] Created account at resend.com
- [ ] Created API Key → Copied re_... key
- [ ] For testing: Using onboarding@resend.dev + sending to own email
- [ ] OR for production: Added domain, added DNS TXT records, waited for Verified, using maintenance@yourdomain.com
- [ ] Added RESEND_API_KEY and RESEND_FROM_EMAIL to .env.local
- [ ] Restarted npm run dev after env change
- [ ] Tested by creating job assigned to own email and checking inbox + Resend Logs

If both checklists done, Step 2 is complete! Move to Step 3 (Firestore + Storage) which is already done if you created database in test mode.

Need me to explain Step 3 (Firestore & Storage) or Step 5 (Vercel deploy) in same detail?
