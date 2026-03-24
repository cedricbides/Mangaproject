# MangaVerse — Full-Stack Manga Site (MERN)

A complete manga reading platform with MangaDex integration, admin panel, user profiles, and local manga management.

---


## Features

### Catalog Page (`/catalog`)
- Browse all manga from MangaDex API with full pagination
- Genre pills, status filters, sort options (Popular / Latest / Newest / A-Z)
- Toggle between Grid and List view
- Separate "Site Exclusives" tab showing admin-added manga

### User Side

- **Login Page** (`/login`) — Email/password + Google OAuth
- **Profile Page** (`/profile`) — Favorites grid, reading history
- First account registered automatically becomes Admin


### Admin Dashboard (`/admin`)
- **Stats** — User count, manga count, chapter count
- **Manga Management** — Add / edit / delete local manga with cover URL, genres, status, author
- **Chapter Management** — Three import modes:
  - **MangaDex Import** — Paste manga page URL, pick chapters from a list, import in bulk (pages fetched live at read time, never expire)
  - **URL Import** — Paste image URLs one per line
  - **File Upload** — Drag and drop image files
- **User Management** — View all users, promote/demote admin role

### MangaDex Chapter Import
- Paste any MangaDex manga URL (e.g. `https://mangadex.org/title/UUID/manga-name`)
- Loads full English chapter list with checkboxes
- Select all or pick individual chapters, bulk import in one click
- Pages are fetched live from MangaDex at-home server on every read — URLs never expire
- Refresh button in reader if images stop loading mid-session

### Image Proxy

- Backend proxy at `GET /api/proxy/image?url=...` fetches external images server-side
- Bypasses CORS restrictions and hotlink protection on image CDNs
- 24-hour cache, streams directly to client


### Publish / Draft System
- Imported chapters are Draft by default — only visible to admins
- Admins can publish/unpublish individual chapters with one click
- **Bulk Edit mode** — select multiple chapters to publish, unpublish, or delete

- Published chapters appear for all users; drafts are admin-only

---


## Project Structure


```
mangasite/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   ├── User.ts                    # role, password fields
│   │   │   ├── LocalManga.ts              # Admin-managed manga
│   │   │   ├── LocalChapter.ts            # Admin-managed chapters
│   │   │   ├── MangaDexManualChapter.ts   # MangaDex-linked chapters (with mdxChapterId + published)
│   │   │   ├── HiddenChapter.ts           # Soft-hidden API chapters
│   │   │   └── DeletedChapter.ts          # Permanently removed API chapters
│   │   ├── routes/
│   │   │   ├── auth.ts          # Email/password + Google OAuth
│   │   │   ├── admin.ts         # Admin CRUD + bulk publish/delete
│   │   │   ├── localManga.ts    # Public local manga + published chapters
│   │   │   ├── mangadex.ts      # MangaDex proxy + manga-chapters + chapter-pages endpoints
│   │   │   ├── proxy.ts         # Image proxy (bypasses CORS/hotlink)
│   │   │   ├── upload.ts        # File upload (multer)
│   │   │   └── favorites.ts
│   │   ├── middleware/
│   │   │   └── auth.ts          # requireAuth, requireAdmin
│   │   └── server.ts
└── frontend/
    └── src/
        ├── pages/
        │   ├── Catalog.tsx           # Full catalog with filters
        │   ├── Profile.tsx           # User profile + history
        │   ├── Login.tsx             # Email/password login
        │   ├── Admin.tsx             # Admin dashboard
        │   ├── MangaDetail.tsx       # MangaDex manga detail + chapter import modal
        │   ├── ManualReader.tsx      # Reader — fetches fresh MangaDex pages live
        │   ├── LocalMangaDetail.tsx  # Local manga detail
        │   └── LocalReader.tsx       # Reader for local chapters
        ├── context/
        │   └── AuthContext.tsx       # isAdmin, loginWithEmail, register
        └── types/index.ts            # LocalManga, LocalChapter, role
```

---


## Setup


### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in MONGODB_URI and SESSION_SECRET
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---


## Admin Access

1. Go to `/login` and register an account
2. The first registered account automatically becomes Admin

3. Admin badge appears in the navbar
4. Access `/admin` for the dashboard

Or manually set `role: "admin"` in MongoDB for a user document.

---


## API Endpoints


### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |
| GET | `/auth/google` | Google OAuth |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/logout` | Logout |

### Admin (requires admin role)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/stats` | User / manga / chapter counts |
| GET/POST | `/api/admin/manga` | List / create local manga |
| PUT/DELETE | `/api/admin/manga/:id` | Update / delete local manga |
| GET/POST | `/api/admin/manga/:id/chapters` | List / create local chapters |
| PUT/DELETE | `/api/admin/chapters/:id` | Update / delete local chapter |
| GET/POST | `/api/admin/mangadex/:mangaDexId/chapters` | List / create MangaDex chapters |
| PUT/DELETE | `/api/admin/mangadex/chapters/:id` | Update / delete MangaDex chapter |
| POST | `/api/admin/mangadex/chapters/bulk-delete` | Bulk delete by IDs |
| POST | `/api/admin/mangadex/chapters/bulk-publish` | Bulk publish/unpublish by IDs |
| GET/POST | `/api/admin/mangadex/:id/hidden-chapters` | Hide/show API chapters |
| DELETE | `/api/admin/mangadex/:id/hidden-chapters/:chapterId` | Restore hidden chapter |
| POST | `/api/admin/mangadex/:id/deleted-chapters` | Permanently delete API chapter |
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/role` | Promote / demote user |

### Local Manga (public)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/local-manga` | All local manga |
| GET | `/api/local-manga/:slug` | Single manga by slug or ID |
| GET | `/api/local-manga/:id/chapters` | Chapters for a manga |
| GET | `/api/local-manga/chapter/:id` | Single local chapter |
| GET | `/api/local-manga/manual-chapter/:id` | Single MangaDex manual chapter |
| GET | `/api/local-manga/manual-chapters/:mangaDexId` | Published chapters for a MangaDex manga |

### MangaDex
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/mangadex/manga-chapters/:mangaId` | All English chapters for a manga (for import picker) |
| GET | `/api/mangadex/chapter-pages/:chapterId` | Fresh image URLs from at-home server |
| GET | `/api/mangadex/*` | Generic MangaDex API proxy |

### Utility
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/proxy/image?url=...` | Image proxy (bypasses CORS/hotlink) |
| POST | `/api/upload/pages` | Upload image files (max 50 at once, 10MB each) |
| DELETE | `/api/upload/pages/:filename` | Delete uploaded image |

---


## Admin Workflow — Adding Chapters


### Option A: Import from MangaDex (recommended)
1. Go to a manga detail page on your site
2. Click **+ Add Chapter** (admin only)
3. Paste the MangaDex manga page URL (e.g. `https://mangadex.org/title/UUID/...`)
4. Click **Load Chapters** — full chapter list appears
5. Select the chapters you want (or click **All**)
6. Click **Import X Chapters**

7. Chapters are saved as Draft — select them and click **Publish** to make them visible to users


> Pages are fetched live from MangaDex every time someone reads — no expiry issues.

### Option B: Manual URL import

1. In the chapter modal, switch to the **URL Import** tab

2. Paste image URLs one per line
3. Fill in chapter number and save

### Option C: File upload

1. Switch to the **Upload Files** tab
2. Drag and drop or browse for image files

3. Reorder pages if needed, then save

---


## Notes
- Solo Leveling and other officially licensed manga have no chapters available on MangaDex — this is intentional on MangaDex's side, not a bug
- MangaDex at-home image URLs are session-scoped and expire. The reader fetches fresh ones on every load. Use the Refresh button if images stop mid-session

- The image proxy adds a 24-hour browser cache for performance
>>>>>>> fe805ab47fd5be7866f6a29c09d88b1f2f7eb730

