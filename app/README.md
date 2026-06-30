# 🏡 Family Todo

A tiny, installable **PWA** shared to-do list for a family. Add tasks, assign
them to each other, and get **push notifications** — including friendly nudges
when something has been sitting too long, and "do this next" suggestions you can
send to your partner.

- **Frontend:** Vite + React + TypeScript, `vite-plugin-pwa` (offline + installable)
- **Backend:** [Convex](https://convex.dev) — reactive DB, cron jobs, scheduled actions
- **Push:** Web Push (VAPID) via a custom service worker
- **Auth:** lightweight — one shared family code + a per-device session token

## Features

- ✅ Shared task list, live-syncing across everyone's devices (Convex reactivity)
- 👤 Assign a task to a family member (or leave it for anyone)
- 👉 **Suggest next** — pick a task for someone and they get an instant push
- ⏰ **Overdue nudges** — pinged when a task passes its due date
- 👀 **Stale-task teasing** — "You still haven't done that — it's been a whole week!"
- ☀️ **Daily summary** — a morning push of what's on your plate
- 📱 Installable to the home screen on Android & iOS (iOS 16.4+)

---

## 1. Install & run

```bash
cd app
npm install
```

### Start Convex (creates your backend + generates types)

```bash
npx convex dev
```

The first run logs you in and writes `VITE_CONVEX_URL` into `.env.local`.
Leave this running — it watches `convex/` and regenerates `convex/_generated`.

### Generate VAPID keys (for push)

```bash
npx web-push generate-vapid-keys
```

Copy `.env.example` → `.env.local` and set the **public** key:

```
VITE_CONVEX_URL=https://<your>.convex.cloud   # written by `convex dev`
VITE_VAPID_PUBLIC_KEY=<public key>
```

Give Convex the keys (server side) so it can send pushes:

```bash
npx convex env set VAPID_PUBLIC_KEY  <public key>
npx convex env set VAPID_PRIVATE_KEY <private key>
npx convex env set VAPID_SUBJECT     mailto:you@example.com
```

### Run the app

```bash
npm run dev          # frontend only (Convex must be running in another terminal)
# or
npm run dev:all      # runs `vite` + `convex dev` together
```

Open the printed URL on your phone (same network, or use the Convex/Vite tunnel)
and **Add to Home Screen**, then tap **Enable** on the notifications banner.

> **iPhone:** Web Push only works once the app is installed to the Home Screen.
> Open it from the Home Screen icon (not Safari) before enabling notifications.

---

## 2. How the family joins

1. One person taps **Create family**, sets a family name + a secret **family code**.
2. Everyone else taps **Join family** and enters that same code + their name.

The code is the only shared secret. Each device gets its own session token stored
in `localStorage`.

---

## 3. Deploy

### Backend (Convex)

```bash
npx convex deploy
```

Set the same `VAPID_*` env vars on the production deployment:

```bash
npx convex env set --prod VAPID_PUBLIC_KEY  <public key>
npx convex env set --prod VAPID_PRIVATE_KEY <private key>
npx convex env set --prod VAPID_SUBJECT     mailto:you@example.com
```

### Frontend (Cloudflare Pages)

Let Convex deploy the backend **and** build the frontend in one step — this
generates `convex/_generated`, deploys functions, and injects the production
`VITE_CONVEX_URL` automatically:

- **Build command:** `npx convex deploy --cmd 'npm run build'`
- **Build output directory:** `dist`
- **Root directory:** `app`
- **Environment variables:**
  - `CONVEX_DEPLOY_KEY` = a **production deploy key** from the Convex dashboard
    (Settings → Deploy keys). This is what lets the build deploy the backend.
  - `VITE_VAPID_PUBLIC_KEY` = your VAPID public key

`public/_redirects` already handles SPA routing. Vercel/Netlify work the same way
(output `dist`, same build command + env vars).

> Building locally with `npm run build` instead? Run `npx convex dev` (or
> `npx convex codegen`) first so `convex/_generated` exists, and set
> `VITE_CONVEX_URL` in `.env.local`.

---

## 4. Project layout

```
app/
├─ convex/                 # backend (Convex functions)
│  ├─ schema.ts            # families, members, todos, pushSubscriptions
│  ├─ families.ts          # create/join family, session, members
│  ├─ todos.ts             # add/toggle/update/remove/suggest
│  ├─ subscriptions.ts     # save/remove Web Push subscriptions
│  ├─ push.ts              # "use node" action that sends Web Push (VAPID)
│  ├─ nudges.ts            # overdue / stale / daily-summary logic
│  └─ crons.ts             # schedules for the nudges
├─ src/
│  ├─ sw.ts                # service worker: push + notificationclick + precache
│  ├─ lib/push.ts          # subscribe/unsubscribe helpers
│  ├─ components/          # JoinScreen, TodoApp, TodoItem, AddTodoForm, ...
│  └─ ...
└─ scripts/generate-icons.mjs  # regenerates the PWA icons (no deps)
```

## Notes & tradeoffs

- **Auth is intentionally light.** Anyone with the family code can join; per-device
  tokens authorize requests. Great for a private family app, not for public use.
- **Cron timezones** in `convex/crons.ts` are in **UTC** — adjust `hourUTC` to your
  timezone (the daily summary defaults to 00:00 UTC ≈ 07:00 Bangkok).
- Regenerate icons anytime with `node scripts/generate-icons.mjs`.
