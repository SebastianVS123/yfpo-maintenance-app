# Cloudinary Setup - Free 25GB, No Billing Card Needed

You said you won't enter details anywhere - Cloudinary is perfect: **Free, no credit card required**, 25GB storage, fast CDN.

## Why Cloudinary?

- **Firebase Storage**: Now requires billing card (Blaze plan) - you don't want this
- **Cloudinary**: Free tier = 25GB storage, 25GB bandwidth/month, NO card needed, forever free
- We keep Firebase for Auth + Firestore (still free, no card) + Cloudinary for photos = 100% free, no billing anywhere

## Setup - 3 Minutes, No Card

### 1. Create Account

1. Go to https://cloudinary.com
2. Click **Sign Up Free** top right
3. Sign up with email, Google, or GitHub
4. No credit card asked! Just email verification
5. You'll land on Dashboard

### 2. Get Your Credentials

On Dashboard (https://console.cloudinary.com/console), you'll see:

```
Product Environment Credentials
Cloud name: dxxxxxxxxx  (e.g. dabc123xyz)
API Key: 123456789012345
API Secret: AbC... (click eye icon to show) - KEEP SECRET!
API Environment variable: CLOUDINARY_URL=cloudinary://...
```

Copy:
- **Cloud name**: e.g. `dabc123xyz`
- **API Key**: e.g. `123456789012345`
- **API Secret**: e.g. `AbCdEfGhIjKlMnOpQrStUvWx`

### 3. Add to .env.local

In your project `maintenance-jobcard-app/.env.local`:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dabc123xyz
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=AbCdEfGhIjKlMnOpQrStUvWx
```

**IMPORTANT:**
- `NEXT_PUBLIC_` prefix means visible to browser (ok for cloud name)
- API Key and Secret WITHOUT NEXT_PUBLIC_ = server only, secret, not visible to users
- Never commit .env.local to GitHub (it's in .gitignore)

### 4. How It Works in App

- Manager creates job → Selects photos → Clicks Confirm
- Photos uploaded to `/api/upload` → Server uploads to Cloudinary folder `maintenance-jobs/{jobId}/issue`
- Cloudinary returns URL like `https://res.cloudinary.com/dabc123xyz/image/upload/v123/maintenance-jobs/.../photo.jpg`
- URL saved in Firestore `jobPhotos` collection
- Operator sees photo via that URL
- Same for completion photos → folder `maintenance-jobs/{jobId}/completion`

### 5. Test It

1. Add env vars to `.env.local`
2. Restart dev server: `npm run dev` (must restart after env change!)
3. Go to `/api/upload` in browser: http://localhost:3000/api/upload
   - Should show: `{"configured": true, "cloudName": "dabc123xyz", "message": "Cloudinary configured ✅"}`
   - If shows `configured: false`, env vars wrong or not restarted
4. Login → Create Job → Upload photo → Should work, no billing error!
5. Check Cloudinary Dashboard → Media Library → Should see folder `maintenance-jobs` with your photos

### 6. Free Tier Limits

- **Storage**: 25GB free (Firebase free was 5GB, so 5x more!)
- **Bandwidth**: 25GB/month free
- **Transformations**: 25k/month free (we use auto-optimization)
- **No card needed**, ever

For maintenance app:
- 1 photo ~1-2MB after Cloudinary optimization (we limit to 1200x1200, auto quality)
- 1000 photos = ~2GB → Well under 25GB free
- 10 users viewing 100 photos/day = 200MB/day bandwidth → Well under 25GB/month

### 7. Vercel Deploy

1. Vercel → Your Project → Settings → Environment Variables
2. Add:
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dabc123xyz
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=AbCdEfGhIjKlMnOpQrStUvWx
```
3. Redeploy

### 8. Security

- Cloud name is public (ok, it's in image URLs)
- API Key + Secret are SECRET - only on server, never exposed to browser
- Our `/api/upload` route does NOT require auth for MVP (anyone can upload), but we check Firebase Auth in real app? For MVP we allow all authenticated users (Firebase Auth check in page, but API open). You can tighten later by verifying Firebase ID token in API route.

### 9. Troubleshooting

**"Cloudinary not configured" mock URL:**
- Env vars missing or typo
- Did you restart `npm run dev` after adding env?
- Check .env.local has no spaces around `=`
- Private key with quotes? Cloudinary secret should NOT have quotes, just raw string

**Upload fails with "Invalid API key":**
- API Key or Secret wrong
- Copy again from Cloudinary Dashboard → Settings → Access Keys
- Make sure Cloud name matches exactly (lowercase)

**Photos not showing:**
- Check Firestore `jobPhotos` collection → Does it have url field with cloudinary.com URL?
- Check browser console for 403 errors → Might be Cloudinary settings, but default allows public read

**Want to delete photos:**
- Cloudinary Dashboard → Media Library → maintenance-jobs folder → Select → Delete

### 10. Alternative: Unsigned Upload (No API Secret on Server)

If you don't want to put API Secret on server, you can create unsigned upload preset:

1. Cloudinary Dashboard → Settings → Upload → Upload presets → Add upload preset
   - Name: `maintenance_unsigned`
   - Signing Mode: Unsigned
   - Folder: `maintenance-jobs`
   - Save
2. Then client can upload directly to Cloudinary without server API route, using only cloud name + preset name
3. Less secure (anyone can upload to your account if they know preset), but no secret needed

We use signed upload (server route) for security - secret stays server-side.

---

## Summary Checklist:

- [ ] Created Cloudinary account at cloudinary.com (no card)
- [ ] Copied Cloud name, API Key, API Secret from Dashboard
- [ ] Added to `.env.local`:
  - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  - CLOUDINARY_API_KEY
  - CLOUDINARY_API_SECRET
- [ ] Restarted `npm run dev`
- [ ] Tested `/api/upload` → Shows configured true
- [ ] Created job with photo → Photo appears in Cloudinary Media Library
- [ ] Added same env vars to Vercel → Redeployed
- [ ] No billing card entered anywhere! ✅

Done! 100% free, no billing, 25GB photos.
