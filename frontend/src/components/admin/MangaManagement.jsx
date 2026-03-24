import { useState } from "react";

const MOCK_LOCAL = [
  { id: "1", title: "Bleach: Thousand-Year Blood War", author: "Tite Kubo", status: "completed", genres: ["Action", "Supernatural"], views: 14820, chapters: 12, cover: "https://placehold.co/56x76/1a1a2e/e8394d?text=B", featured: true, addedAt: "2025-03-08" },
  { id: "2", title: "Blue Period", author: "Tsubasa Yamaguchi", status: "ongoing", genres: ["Drama", "Slice of Life"], views: 7340, chapters: 5, cover: "https://placehold.co/56x76/0d1b2a/3b82f6?text=BP", featured: false, addedAt: "2025-03-06" },
  { id: "3", title: "Dungeon Meshi", author: "Ryoko Kui", status: "completed", genres: ["Fantasy", "Comedy"], views: 21050, chapters: 18, cover: "https://placehold.co/56x76/0f2417/10b981?text=DM", featured: true, addedAt: "2025-03-01" },
  { id: "4", title: "Vinland Saga", author: "Makoto Yukimura", status: "ongoing", genres: ["Historical", "Action"], views: 9870, chapters: 7, cover: "https://placehold.co/56x76/1a120b/f59e0b?text=VS", featured: false, addedAt: "2025-02-22" },
  { id: "5", title: "Witch Hat Atelier", author: "Kamome Shirahama", status: "ongoing", genres: ["Fantasy", "Adventure"], views: 5200, chapters: 3, cover: "https://placehold.co/56x76/160d26/8b5cf6?text=WH", featured: false, addedAt: "2025-02-10" },
];

const MOCK_MDX = [
  { id: "m1", title: "Chainsaw Man", status: "ongoing", tags: ["Action", "Horror"], year: 2018, imported: true, cover: "https://placehold.co/80x110/1a0a0a/e8394d?text=CM" },
  { id: "m2", title: "Jujutsu Kaisen", status: "ongoing", tags: ["Action", "Supernatural"], year: 2018, imported: true, cover: "https://placehold.co/80x110/0a0a1a/3b82f6?text=JJK" },
  { id: "m3", title: "Berserk", status: "hiatus", tags: ["Fantasy", "Horror"], year: 1989, imported: false, cover: "https://placehold.co/80x110/1a1008/f59e0b?text=BK" },
  { id: "m4", title: "Attack on Titan", status: "completed", tags: ["Action", "Drama"], year: 2009, imported: true, cover: "https://placehold.co/80x110/0d1a0d/10b981?text=AoT" },
  { id: "m5", title: "Solo Leveling", status: "completed", tags: ["Action", "Fantasy"], year: 2018, imported: false, cover: "https://placehold.co/80x110/0a0d1a/8b5cf6?text=SL" },
  { id: "m6", title: "Spy x Family", status: "ongoing", tags: ["Comedy", "Action"], year: 2019, imported: false, cover: "https://placehold.co/80x110/1a140a/f59e0b?text=SxF" },
  { id: "m7", title: "Frieren: Beyond Journey's End", status: "ongoing", tags: ["Fantasy", "Slice of Life"], year: 2020, imported: true, cover: "https://placehold.co/80x110/0d1520/06b6d4?text=FR" },
  { id: "m8", title: "Mashle", status: "completed", tags: ["Action", "Comedy"], year: 2020, imported: false, cover: "https://placehold.co/80x110/1a1a0d/84cc16?text=MA" },
  { id: "m9", title: "Blue Lock", status: "ongoing", tags: ["Sports", "Action"], year: 2018, imported: false, cover: "https://placehold.co/80x110/0a1020/60a5fa?text=BL" },
  { id: "m10", title: "My Hero Academia", status: "completed", tags: ["Action", "School Life"], year: 2014, imported: true, cover: "https://placehold.co/80x110/1a0d0a/fb923c?text=MHA" },
];

const STATUS_STYLE = {
  ongoing:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  hiatus:    "bg-amber-500/15 text-amber-400 border-amber-500/25",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/25",
};

const MDX_STATUS_DOT = {
  ongoing:   "bg-emerald-400",
  completed: "bg-blue-400",
  hiatus:    "bg-amber-400",
  cancelled: "bg-red-400",
};

function Badge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium tracking-wide ${STATUS_STYLE[status] || STATUS_STYLE.hiatus}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${MDX_STATUS_DOT[status] || 'bg-gray-400'}`} />
      {status}
    </span>
  );
}

function IconBtn({ children, danger, title, onClick, active }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: "6px",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: danger ? "rgba(239,68,68,0.2)" : active ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.08)",
        background: danger ? "rgba(239,68,68,0.07)" : active ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
        color: danger ? "#f87171" : active ? "#c4b5fd" : "#9ca3af",
        cursor: "pointer",
        transition: "all 0.15s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

// ─── SVG Icons ─────────────────────────────────────────────────────────────
const Icons = {
  Plus: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  Chevron: ({ open }) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>,
  BookOpen: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
  Eye: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Sort: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Import: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Check: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  Star: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Grid: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  List: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  Refresh: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  Globe: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  X: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Clock: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

// ─── Local Manga Row ────────────────────────────────────────────────────────
function LocalRow({ manga, expanded, onToggle }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        background: expanded ? "rgba(255,255,255,0.04)" : hovered ? "rgba(255,255,255,0.025)" : "transparent",
        borderRadius: "14px",
        border: "1px solid",
        borderColor: expanded ? "rgba(255,255,255,0.1)" : "transparent",
        transition: "all 0.18s",
        marginBottom: "2px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "10px 14px" }}>
        {/* Cover */}
        <img src={manga.cover} alt={manga.title}
          style={{ width: 40, height: 54, borderRadius: 8, objectFit: "cover", flexShrink: 0, opacity: 0.9 }} />

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
              {manga.title}
            </span>
            {manga.featured && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                <Icons.Star /> Featured
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{manga.author}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#374151", flexShrink: 0 }} />
            <Badge status={manga.status} />
            <span style={{ fontSize: 11, color: "#6b7280" }}>{manga.genres.slice(0,2).join(" · ")}</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: "center", minWidth: 48 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>
              {manga.views.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
              <Icons.Eye /> views
            </div>
          </div>
          <div style={{ textAlign: "center", minWidth: 36 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{manga.chapters}</div>
            <div style={{ fontSize: 10, color: "#4b5563", display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
              <Icons.BookOpen /> ch.
            </div>
          </div>
          <div style={{ fontSize: 10, color: "#4b5563", display: "flex", alignItems: "center", gap: 3, minWidth: 70, justifyContent: "flex-end" }}>
            <Icons.Clock />{manga.addedAt}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", items: "center", gap: 6, flexShrink: 0 }}>
          <IconBtn title="Add Chapter"><Icons.Plus /></IconBtn>
          <IconBtn title="Edit Manga"><Icons.Edit /></IconBtn>
          <IconBtn title="Delete Manga" danger><Icons.Trash /></IconBtn>
          <IconBtn title={expanded ? "Collapse" : "Expand chapters"} active={expanded} onClick={onToggle}>
            <Icons.Chevron open={expanded} />
          </IconBtn>
        </div>
      </div>

      {/* Expanded Chapter Drawer */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px 14px", background: "rgba(0,0,0,0.15)", borderRadius: "0 0 14px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              {manga.chapters} Chapters
            </span>
            <button style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#818cf8", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
              <Icons.Plus /> Add Chapter
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Array.from({ length: Math.min(manga.chapters, 4) }, (_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#d1d5db" }}>Ch.{manga.chapters - i}</span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>— Chapter Title</span>
                  <span style={{ fontSize: 10, color: "#4b5563" }}>42 pages</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ fontSize: 11, color: "#60a5fa", background: "none", border: "none", cursor: "pointer" }}>Preview</button>
                  <button style={{ padding: "3px", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><Icons.Trash /></button>
                </div>
              </div>
            ))}
            {manga.chapters > 4 && (
              <div style={{ textAlign: "center", padding: "6px", fontSize: 11, color: "#6b7280", cursor: "pointer" }}>
                +{manga.chapters - 4} more chapters →
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MangaDex Card ──────────────────────────────────────────────────────────
function MDXCard({ manga }) {
  const [imported, setImported] = useState(manga.imported);
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", transition: "all 0.2s", boxShadow: hov ? "0 0 0 1px rgba(59,130,246,0.3)" : "none" }}>
      <div style={{ position: "relative" }}>
        <img src={manga.cover} alt={manga.title}
          style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", top: 6, right: 6 }}>
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
            {manga.status}
          </span>
        </div>
        {imported && (
          <div style={{ position: "absolute", bottom: 6, left: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, padding: "2px 6px", borderRadius: 99, background: "rgba(16,185,129,0.85)", color: "#fff", backdropFilter: "blur(4px)" }}>
              <Icons.Check /> Imported
            </span>
          </div>
        )}
        {/* Hover overlay */}
        {hov && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <button style={{ fontSize: 10, padding: "5px 10px", borderRadius: 7, background: "rgba(232,57,77,0.9)", color: "#fff", border: "none", cursor: "pointer" }}>View</button>
            {!imported && (
              <button onClick={() => setImported(true)}
                style={{ fontSize: 10, padding: "5px 10px", borderRadius: 7, background: "rgba(16,185,129,0.9)", color: "#fff", border: "none", cursor: "pointer" }}>
                + Import
              </button>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <p style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {manga.title}
        </p>
        <p style={{ fontSize: 10, color: "#6b7280", marginTop: 3 }}>{manga.tags.join(" · ")}</p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function MangaManagement() {
  const [view, setView]       = useState("local"); // "local" | "import"
  const [sortBy, setSortBy]   = useState("newest");
  const [search, setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null);
  const [gridView, setGridView] = useState(false);
  const [mdxSearch, setMdxSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);

  const sorted = [...MOCK_LOCAL]
    .filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.addedAt) - new Date(a.addedAt);
      if (sortBy === "oldest") return new Date(a.addedAt) - new Date(b.addedAt);
      if (sortBy === "views") return b.views - a.views;
      if (sortBy === "az") return a.title.localeCompare(b.title);
      return 0;
    });

  const filteredMdx = MOCK_MDX.filter(m =>
    m.title.toLowerCase().includes(mdxSearch.toLowerCase())
  );

  const totalImported = MOCK_MDX.filter(m => m.imported).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b0b14",
      color: "#e2e8f0",
      fontFamily: "'Inter', sans-serif",
      padding: "24px",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::placeholder { color: #4b5563; }
        select option { background: #13131f; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", letterSpacing: "-0.02em", margin: 0 }}>
              Manga Management
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "3px 0 0" }}>
              {MOCK_LOCAL.length} manually added · {totalImported} imported from MangaDex
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: "#e8394d", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(232,57,77,0.3)" }}>
            <Icons.Plus /> Add Manga
          </button>
        </div>

        {/* ── LIVE INDICATOR ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              {liveEnabled ? (
                <>
                  <span style={{ position: "absolute", width: 8, height: 8, borderRadius: "50%", background: "#34d399", opacity: 0.6, animation: "ping 1.5s infinite" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", position: "relative" }} />
                </>
              ) : (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#374151" }} />
              )}
            </div>
            <span style={{ fontSize: 11, color: liveEnabled ? "#34d399" : "#6b7280", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {liveEnabled ? "Live" : "Paused"}
            </span>
            <span style={{ fontSize: 11, color: "#4b5563" }}>Updated 8s ago</span>
            <button style={{ padding: "3px", background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
              <Icons.Refresh />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Auto-refresh 30s</span>
            <button onClick={() => setLiveEnabled(v => !v)}
              style={{ width: 36, height: 20, borderRadius: 99, background: liveEnabled ? "#10b981" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
              <span style={{ position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transform: liveEnabled ? "translateX(16px)" : "translateX(0)", transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </button>
          </div>
        </div>

        {/* ── SEGMENT TABS ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.04)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20, width: "fit-content" }}>
          {[
            { id: "local", label: "My Manga", count: MOCK_LOCAL.length },
            { id: "import", label: "Import from MangaDex", count: null },
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)}
              style={{
                padding: "7px 18px",
                borderRadius: 9,
                fontSize: 12,
                fontWeight: view === tab.id ? 600 : 400,
                color: view === tab.id ? "#fff" : "#9ca3af",
                background: view === tab.id ? "#e8394d" : "transparent",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}>
              {tab.label}
              {tab.count !== null && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: view === tab.id ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", color: view === tab.id ? "#fff" : "#9ca3af" }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MY MANGA VIEW                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {view === "local" && (
          <div>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }}>
                  <Icons.Search />
                </span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search your manga..."
                  style={{ width: "100%", padding: "8px 12px 8px 34px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#e2e8f0", fontSize: 13, outline: "none" }}
                />
              </div>

              {/* Sort */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af" }}>
                <Icons.Sort />
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ background: "transparent", border: "none", fontSize: 12, color: "#9ca3af", cursor: "pointer", outline: "none" }}>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="views">Most Views</option>
                  <option value="az">A → Z</option>
                </select>
              </div>

              {/* Grid / List toggle */}
              <div style={{ display: "flex", gap: 2, padding: 3, background: "rgba(255,255,255,0.04)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={() => setGridView(false)}
                  style={{ padding: "5px 8px", borderRadius: 7, background: !gridView ? "rgba(255,255,255,0.08)" : "transparent", border: "none", cursor: "pointer", color: !gridView ? "#e2e8f0" : "#6b7280", display: "flex" }}>
                  <Icons.List />
                </button>
                <button onClick={() => setGridView(true)}
                  style={{ padding: "5px 8px", borderRadius: 7, background: gridView ? "rgba(255,255,255,0.08)" : "transparent", border: "none", cursor: "pointer", color: gridView ? "#e2e8f0" : "#6b7280", display: "flex" }}>
                  <Icons.Grid />
                </button>
              </div>
            </div>

            {/* List View */}
            {!gridView && (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                {/* Column headers */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ width: 40, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Title</div>
                  <div style={{ width: 160, fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, textAlign: "right" }}>Views · Chapters · Added</div>
                  <div style={{ width: 120, fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, textAlign: "center" }}>Actions</div>
                </div>
                <div style={{ padding: "6px 0" }}>
                  {sorted.length === 0 ? (
                    <div style={{ padding: "32px 16px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                      No manga found. <button onClick={() => setShowAddModal(true)} style={{ color: "#e8394d", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>+ Add one</button>
                    </div>
                  ) : sorted.map(m => (
                    <LocalRow
                      key={m.id}
                      manga={m}
                      expanded={expanded === m.id}
                      onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Grid View */}
            {gridView && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                {sorted.map(m => (
                  <div key={m.id} style={{ borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <img src={m.cover} alt={m.title} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                    <div style={{ padding: "8px 10px" }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                        <Badge status={m.status} />
                        <span style={{ fontSize: 10, color: "#6b7280" }}>{m.chapters} ch</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* IMPORT FROM MANGADEX VIEW                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {view === "import" && (
          <div>
            {/* Info banner */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.18)", marginBottom: 16 }}>
              <Icons.Globe />
              <p style={{ fontSize: 12, color: "#93c5fd", margin: 0 }}>
                Browse MangaDex's catalogue and import titles to your site. Imported titles gain a dedicated page with chapter tracking.
              </p>
            </div>

            {/* Search */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#6b7280" }}>
                <Icons.Search />
              </span>
              <input
                value={mdxSearch}
                onChange={e => setMdxSearch(e.target.value)}
                placeholder="Search MangaDex titles..."
                style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", fontSize: 13, outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{filteredMdx.length} titles · {totalImported} already imported</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              {filteredMdx.map(m => <MDXCard key={m.id} manga={m} />)}
            </div>

            {/* Pagination stub */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Showing 1–10 of 45,017</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>← Prev</button>
                <button style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>Next →</button>
              </div>
            </div>
          </div>
        )}

        {/* ── ADD MANGA MODAL ────────────────────────────────────────────── */}
        {showAddModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ width: "100%", maxWidth: 460, background: "#13131f", borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb", margin: 0 }}>Add Manga</h3>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Upload a new title to your site</p>
                </div>
                <button onClick={() => setShowAddModal(false)}
                  style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", display: "flex" }}>
                  <Icons.X />
                </button>
              </div>
              {[["Title", "text", "e.g. My Hero Academia"], ["Author", "text", "e.g. Kohei Horikoshi"], ["Cover URL", "text", "https://..."]].map(([label, type, ph]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{label}</label>
                  <input type={type} placeholder={ph}
                    style={{ width: "100%", padding: "9px 13px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#e2e8f0", fontSize: 13, outline: "none" }} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Status</label>
                <select style={{ width: "100%", padding: "9px 13px", borderRadius: 9, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#e2e8f0", fontSize: 13, outline: "none" }}>
                  <option>ongoing</option><option>completed</option><option>hiatus</option><option>cancelled</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => setShowAddModal(false)}
                  style={{ flex: 2, padding: "10px", borderRadius: 10, background: "#e8394d", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(232,57,77,0.3)" }}>
                  Add Manga
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes ping { 0%,100%{transform:scale(1);opacity:.75} 50%{transform:scale(2.2);opacity:0} }`}</style>
      </div>
    </div>
  );
}