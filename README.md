# MangaVerse

A full-stack manga reading platform built with the MERN stack, featuring MangaDex API integration, local manga uploads, user authentication, reading progress tracking, social features, and a full admin dashboard.

> **Live project** · Docker-ready · CI/CD via GitHub Actions

---

## Features

**For Readers**
- Browse and read manga from the MangaDex API (proxied through backend)
- Read locally uploaded manga managed by admins
- Track reading progress per chapter
- Favorite, rate, and review manga
- Comment on chapters and manga
- Personalized reading lists and feed
- Push notifications for new chapters
- Offline reading support via service worker

**For Admins**
- Full admin dashboard with role-based access control
- Upload and manage local manga and chapters (images, URL import, MangaDex import)
- Schedule chapter releases and announcements
- Bulk manga management
- Visitor analytics and session tracking
- Activity logging for all admin actions
- Data export and backup/restore tools
- SEO editor and site settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express, TypeScript |
| **Database** | MongoDB (Mongoose ODM) |
| **Frontend** | React, Vite, TypeScript, Tailwind CSS |
| **Auth** | Passport.js, Google OAuth, session-based |
| **Notifications** | Web Push API (VAPID), in-app notifications |
| **Containerization** | Docker, Docker Compose |
| **Reverse Proxy** | Caddy (HTTPS + routing) |
| **CI/CD** | GitHub Actions |
| **Email** | Resend API (verification, password reset) |

---

## Project Structure

```
MangaVerse/
├── backend/
│   └── src/
│       ├── models/         Mongoose schemas (User, Manga, Chapter, Comment, etc.)
│       ├── routes/         Express REST API handlers
│       ├── middleware/      Auth guards, request sanitization
│       ├── utils/          Email, push notifications, scheduler, image service
│       ├── config/         Passport & OAuth configuration
│       └── server.ts       App entry point
├── frontend/
│   └── src/
│       ├── pages/          Route-level screens (Home, Reader, Admin, Profile, etc.)
│       ├── components/     Shared UI components
│       ├── components/admin/  Admin-specific panels
│       ├── context/        Auth context provider
│       ├── hooks/          Custom hooks (push, reading progress, online status)
│       └── utils/          CSRF, manga helpers, offline storage
├── docker-compose.yml      Full stack: MongoDB + backend + frontend
├── Caddyfile               Reverse proxy config
└── .github/workflows/      CI pipeline
```

---

## Run Locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in: MONGODB_URI, SESSION_SECRET
npm run dev
# Runs on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

### Full Stack with Docker

```bash
cp backend/.env.example .env
# Edit .env with your values
docker compose up --build
```

Starts MongoDB, backend, and frontend together with persistent storage.

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | Session cookie signing key |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |
| `RESEND_API_KEY` | Email service for verification/reset |
| `VAPID_PUBLIC_KEY` | Web push notifications |
| `VAPID_PRIVATE_KEY` | Web push notifications |
| `CLIENT_URL` | Frontend URL (default: `http://localhost:3000`) |
| `SERVER_URL` | Backend URL (default: `http://localhost:5000`) |

Generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## API Overview

```
Auth
  POST /api/auth/register
  POST /api/auth/login
  GET  /api/auth/me

MangaDex
  GET  /api/mangadex/*
  GET  /api/mangadex/chapter-pages/:chapterId

Upload
  POST /api/upload/pages

Admin (protected)
  /api/admin/*
  /api/admin/activity
  /api/admin/backup
  /api/admin/export
  /api/admin/permissions
  /api/admin/visitors

Social
  /api/social/*     (comments, ratings, reviews, reports)

Notifications
  /api/notifications/*
```

---

## Admin Access

The first registered account becomes `superadmin` automatically.

To manually set a role in MongoDB:
```js
db.users.updateOne(
  { email: "you@example.com" },
  { $set: { role: "admin" } }
)
```

Roles: `user` → `moderator` → `admin` → `superadmin`

---

## Security

- Rate limiting (production only)
- Request sanitization — strips keys with `$` or `.` to prevent NoSQL injection
- CSRF token protection (`GET /api/csrf-token`)
- Sessions stored in MongoDB via `connect-mongo` (7-day expiry)
- Role-based route guards on all admin endpoints

---

## Chapter Import Methods

1. **MangaDex import** — paste a MangaDex manga URL
2. **URL import** — one image URL per line
3. **File upload** — drag and drop images, reorder pages

Chapters save as drafts until an admin publishes them.

---

## Key Concepts Demonstrated

| Concept | Where |
|---|---|
| REST API design | `backend/src/routes/` — 15+ route modules |
| Database modeling | `backend/src/models/` — 15+ Mongoose schemas |
| Authentication & authorization | Passport.js, sessions, role-based middleware |
| Docker & containerization | `docker-compose.yml`, separate Dockerfiles per service |
| CI/CD pipeline | `.github/workflows/ci.yml` |
| Real-time features | Push notifications, reading progress sync |
| Admin data tools | Export, backup/restore, visitor analytics |
| Frontend state management | React context, custom hooks |
| Scheduled jobs | `backend/src/utils/scheduler.ts` |
