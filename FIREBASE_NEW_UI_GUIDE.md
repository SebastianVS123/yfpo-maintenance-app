# Firebase Console - New UI Guide (No "Build" Option? Here's Fix)

Firebase updated their console in 2024-2025. The "Build" label is GONE or hidden. Here's how to find everything in the NEW UI.

## The New Sidebar Layout (2025)

When you open https://console.firebase.google.com → Your project, left sidebar now looks like:

```
┌─────────────────────────┐
│  Project Overview       │
│  ─────────────────────  │
│  🔍 Search (top bar)    │
│                         │
│  Product categories     │
│  ▸ Authentication       │  ← HERE!
│  ▸ Firestore Database   │  ← HERE!
│  ▸ Realtime Database    │
│  ▸ Storage              │  ← HERE!
│  ▸ Hosting              │
│  ▸ Functions            │
│  ▸ ...                  │
│                         │
│  Or you see icons only  │
│  without labels         │
└─────────────────────────┘
```

**There is NO "Build" heading anymore.** They renamed it to "Product categories" or just show icons.

## 3 Ways to Find Authentication (Use ANY one):

### METHOD 1: Direct Search (Easiest - Works Always)

1. At the very TOP of Firebase Console, there's a search bar that says "Search Firebase"
2. Click it and type: **Authentication**
3. It will show result: "Authentication - Build" → Click it
4. You're now in Authentication page!

Same for:
- Type **Firestore** → Click "Firestore Database"
- Type **Storage** → Click "Storage"

This is the FASTEST way and works no matter what UI version you have.

### METHOD 2: Direct URLs (Even Easier)

Replace `YOUR_PROJECT_ID` with your actual project ID (you see it in Project Settings → General → Project ID)

**Authentication:**
```
https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication
```
Example: If your project ID is `maintenance-jobcard-12345`, go to:
```
https://console.firebase.google.com/project/maintenance-jobcard-12345/authentication
```

**Firestore:**
```
https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore
```

**Storage:**
```
https://console.firebase.google.com/project/YOUR_PROJECT_ID/storage
```

Just paste these in browser, change project ID, and you jump directly there! No menu needed.

### METHOD 3: Find in Sidebar (If Search Fails)

1. Look at LEFT sidebar
2. You might see ONLY ICONS (no text) if your window is narrow
   - Hover over icons, tooltip shows name
   - Or click the hamburger menu ☰ top left to expand sidebar
3. Look for these ICONS:
   - **Authentication**: Icon looks like 👤 person with checkmark, or "A" with key
   - **Firestore Database**: Icon looks like 🗄️ database with flames
   - **Storage**: Icon looks like 📦 box or folder

4. If sidebar is collapsed to icons:
   - Click the `<` arrow or `☰` menu at top left to expand
   - Then you'll see text labels: "Authentication", "Firestore Database", "Storage"

5. If you see "Product categories" with a dropdown arrow `▸` or `▼`:
   - Click "Product categories" to expand
   - Then you'll see Authentication, Firestore, Storage listed

6. If you see "All products" or "See all products" link:
   - Click it → Shows all Firebase products → Find Authentication, Firestore, Storage

## Step-by-Step with NEW UI for Authentication:

**Let's do it together:**

1. Open: https://console.firebase.google.com
2. Click your project (e.g. maintenance-jobcard)
3. **TOP SEARCH BAR**: Click search box at top that says "Search Firebase" or has magnifying glass 🔍
4. Type: `Authentication` → Press Enter
5. Click the first result: "Authentication"
6. You should now be on Authentication page
7. If you see "Get Started" button → Click it
8. Then top tabs: Users | Sign-in method | Settings
9. Click **Sign-in method** tab
10. Find **Email/Password** → Click it (or pencil icon ✏️)
11. Toggle **Enable** ON → Save

**Done! Auth enabled.**

## Same for Firestore:

1. Top search → Type `Firestore` → Click "Firestore Database"
2. If you see "Create database" → Click it
3. Choose location: `europe-west3` (for Pretoria) → Next
4. Start in **Test mode** → Create
5. Done!

## Same for Storage:

1. Top search → Type `Storage` → Click "Storage"
2. If "Get Started" → Click it
3. Test mode → Same location as Firestore → Done

## Still Can't Find It? Screenshots Description:

**New UI 2025 looks like:**

- Left sidebar is DARK GRAY
- Top has Firebase logo + Project name
- Below that, search bar
- Then list of products with ICONS:
  - 🏠 Project Overview (house icon)
  - 🔐 Authentication (person icon)
  - 🔥 Firestore Database (database icon with flame)
  - 💾 Storage (folder icon)
  - etc.

If you DON'T see text, only icons:
- Move mouse to VERY left edge → Sidebar expands
- Or click the 3 lines ☰ at top left

**Alternative: Use Firebase's new "Project shortcuts"**

On Project Overview page (the main dashboard), scroll down:
- You'll see cards like "Authentication", "Firestore", "Storage" with "Get started" buttons
- Click those cards directly!

## Video Walkthrough in Text:

```
You open Firebase Console
→ You see Project Overview with stats
→ Scroll down a bit
→ You see section "Get started by adding Firebase to an app" (ignore)
→ Scroll more
→ You see "Product categories" or cards:
   [Authentication] [Firestore] [Storage] [Hosting]
→ Click Authentication card
→ Done!
```

## Quick Fix Summary:

**If no "Build" menu:**
- Use TOP SEARCH BAR → Type product name → Click result
- OR use direct URL: console.firebase.google.com/project/YOUR_ID/authentication
- OR look for icons in left sidebar, hover to see names, or expand sidebar with ☰

## Your Project ID - Where to Find:

1. Click gear icon ⚙️ top left → Project Settings
2. General tab → Top section shows:
   - Project name: maintenance-jobcard
   - Project ID: maintenance-jobcard-a1b2c (this is what you need for URLs)
   - Project number: 123456789

Copy Project ID for direct URLs.

## Still Stuck?

Tell me:
1. What do you see in left sidebar? (List the items you DO see)
2. Can you see a search bar at top?
3. What happens when you go to: https://console.firebase.google.com/project/YOUR_PROJECT_ID/authentication (replace YOUR_PROJECT_ID)

I'll guide you from there!
