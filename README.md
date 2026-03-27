# MangaVerse

MangaVerse is a MERN-based manga reader with two content sources:
- MangaDex API data (proxied through the backend)
- Locally uploaded manga/chapters managed by admins

It includes user auth, reading progress, comments, favorites, and an admin dashboard.

## Tech Stack

- Backend: Express + TypeScript + MongoDB (Mongoose)
- Frontend: React + Vite + Tailwind

## Project Layout

```text
backend/src/
  models/         Mongoose schemas
  routes/         Express route handlers
  middleware/     Auth and request guards
  utils/          Email, notifications, scheduler, helpers
  config/         Passport and OAuth configuration
  server.ts       Application entry point

frontend/src/
  pages/          Route-level screens
  components/     Shared UI components
  components/admin/
                  Admin-specific panels
  context/        App context providers
  hooks/          Custom hooks
  utils/          Frontend helper utilities
  types/          Shared TypeScript types
```

## Run Locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill at least:
- `MONGODB_URI`
- `SESSION_SECRET`

Then start:

```bash
npm run dev
```

Backend default port: `5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default port: `3000` and API requests are proxied to the backend.

## Run with Docker

```bash
cp backend/.env.example .env
# edit values in .env
docker compose up --build
```

This starts MongoDB, backend, and frontend together with persistent MongoDB storage.

## Environment Variables

Set variables in `backend/.env`. See `.env.example` for full comments.

- `MONGODB_URI`: MongoDB connection string
- `SESSION_SECRET`: session cookie signing secret
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth (optional)
- `RESEND_API_KEY`, `EMAIL_FROM`: email verification and password reset (optional)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: web push notifications (optional)
- `CLIENT_URL`: frontend URL (default `http://localhost:3000`)
- `SERVER_URL`: backend URL (default `http://localhost:5000`)

Generate a strong session secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Admin Access

The first registered account becomes `superadmin`.

You can also update a user role directly in MongoDB:

```js
db.users.updateOne(
  { email: "you@example.com" },
  { $set: { role: "admin" } }
)
```

Roles: `user`, `moderator`, `admin`, `superadmin`.

## Chapter Import Methods

1. MangaDex import from a manga URL
2. URL import (one image URL per line)
3. File upload (drag/drop images, reorder pages)

Imported chapters are saved as drafts until an admin publishes them.

## API Overview

Common endpoints:
- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/mangadex/*`
- `GET /api/mangadex/chapter-pages/:chapterId`
- `GET /api/proxy/image?url=...`
- `POST /api/upload/pages`

Admin endpoints are under ` /api/admin`.

## Security Notes

- Production rate limits are enabled; development skips them
- Request sanitization removes keys with `$` or `.`
- CSRF token endpoint exists at `GET /api/csrf-token`
- Sessions are stored in MongoDB via `connect-mongo` (7-day expiry)

## Notes

- Some officially licensed manga have no chapters on MangaDex by design
- Maintenance mode blocks visitors but still allows admin access