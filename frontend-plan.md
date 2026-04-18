# frontend-plan.md — Curalink Frontend

Derived from backend API contract, CLAUDE.md §9, and the existing React + Vite + Tailwind v4 scaffold.

> Stack locked: **React 19 + Vite 8 + Tailwind v4 + React Query v5 + React Router v7**  
> All backend features must be reachable from the UI. Auth is optional for research — anonymous queries work.

---

## Backend API surface (what the frontend consumes)

| Method | Path | Used in |
|---|---|---|
| `POST` | `/api/v1/auth/register` | RegisterPage |
| `POST` | `/api/v1/auth/login` | LoginPage |
| `POST` | `/api/v1/auth/logout` | Header |
| `GET`  | `/api/v1/auth/me` | auth state |
| `POST` | `/api/v1/research` | QueryForm (new session) |
| `POST` | `/api/v1/followup` | QueryForm (continue session) |
| `GET`  | `/api/v1/session/:id` | SessionSidebar |
| `DELETE`| `/api/v1/session/:id` | SessionSidebar |
| `GET`  | `/api/v1/health` | HealthBadge (header) |

---

## Environment files

### `frontend/.env.development` (local)
```
VITE_API_BASE_URL=
VITE_APP_TITLE=Curalink (dev)
```
`VITE_API_BASE_URL` is empty in dev — Vite proxy (`/api → localhost:5000`) handles it.

### `frontend/.env.production` (deployment)
```
VITE_API_BASE_URL=https://your-backend.railway.app
VITE_APP_TITLE=Curalink
```

### `frontend/.env.example` (checked into git)
```
VITE_API_BASE_URL=
VITE_APP_TITLE=Curalink
```

`api/client.ts` reads `import.meta.env.VITE_API_BASE_URL` as `baseURL` prefix. Empty string = relative paths (dev proxy works). Non-empty = absolute URL (production).

---

## Final folder layout

```
frontend/src/
  api/
    client.ts          update: VITE_API_BASE_URL + auth header injection
    auth.ts            existing
    research.ts        new: research / followup / session CRUD
  types/
    api.ts             mirror backend LLMResponse + all sub-types
  hooks/
    useAuth.ts         existing
    useResearch.ts     new: useResearch, useFollowup
    useSession.ts      new: useSessionHistory, useDeleteSession
  components/
    ui/                Button, Input, Select, Badge, Card, Spinner, Skeleton, Alert
    layout/            AppShell, Header, ProtectedRoute
    research/          QueryForm, ConditionOverview, InsightCard, TrialCard,
                       SourceList, MetadataBar, WarningBanner, ResearchResult
    session/           SessionSidebar, SessionMessage, EmptyState
  pages/
    LoginPage.tsx      polish existing
    RegisterPage.tsx   polish existing
    ResearchPage.tsx   new (main app page — chat-style layout)
  styles/
    tokens.css         CSS custom properties (design tokens)
  lib/
    utils.ts           cn(), formatLatency(), truncate()
  main.tsx
  App.tsx              update routes
```

---

## UI layout (ResearchPage)

```
┌─────────────────────────────────────────────────────────┐
│  Header: logo + health dot + user menu                  │
├──────────────┬──────────────────────────────────────────┤
│  Session     │  Main panel                              │
│  Sidebar     │                                          │
│              │  [Empty state / past turns stacked]      │
│  • sess 1    │                                          │
│  • sess 2    │  ConditionOverview                       │
│  + New       │  InsightCard × N                         │
│              │  TrialCard × N                           │
│              │  SourceList (collapsed by default)       │
│              │  MetadataBar                             │
│              │                                          │
│              ├──────────────────────────────────────────┤
│              │  QueryForm (bottom bar)                  │
└──────────────┴──────────────────────────────────────────┘
```

---

## Design system (Tailwind v4)

`styles/tokens.css` defines all tokens via `@theme`:

```css
@import "tailwindcss";

@theme {
  --color-brand-50:  #eff6ff;
  --color-brand-500: #3b82f6;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;

  --color-surface:   #ffffff;
  --color-muted:     #f8fafc;
  --color-border:    #e2e8f0;

  --color-high:      #16a34a;   /* confidence/evidence: high */
  --color-moderate:  #d97706;   /* confidence/evidence: moderate */
  --color-low:       #dc2626;   /* confidence/evidence: low */

  --font-sans: "Inter", system-ui, sans-serif;
  --radius-card: 0.75rem;
}
```

Google Inter loaded via `index.html` `<link>` preconnect. No extra package needed.

Badge component maps `high/moderate/low` → color tokens automatically.

---

## Phase 1 — Foundation

**Files to create/update:**

1. `frontend/.env.development` — `VITE_API_BASE_URL=`  
2. `frontend/.env.production` — `VITE_API_BASE_URL=https://...`  
3. `frontend/.env.example`  
4. `frontend/src/styles/tokens.css` — `@theme` block above; import in `index.css`  
5. `frontend/src/lib/utils.ts` — `cn()` (clsx + tailwind-merge), `formatLatency(ms)`, `truncate(str, n)`  
6. `frontend/src/types/api.ts` — TypeScript types mirroring backend `LLMResponse` schema:
   - `ResearchRequest`, `ResearchResponse`
   - `ConditionOverview`, `ResearchInsight`, `ClinicalTrialItem`, `SourceItem`, `ResponseMetadata`
   - `SessionSummary` (from `GET /session/:id`)
7. `frontend/src/api/client.ts` — update `baseURL` to `${import.meta.env.VITE_API_BASE_URL}/api/v1`
8. `frontend/src/components/ui/` — 7 base components:
   - `Button.tsx` — variants: `primary | secondary | ghost | destructive`; sizes: `sm | md | lg`
   - `Input.tsx` — label + error message baked in
   - `Select.tsx` — native `<select>` styled
   - `Badge.tsx` — accepts `variant: "high"|"moderate"|"low"|"default"` → maps to color tokens
   - `Card.tsx` — wrapper with `--radius-card` border-radius + optional `padding` prop
   - `Spinner.tsx` — SVG ring, size prop
   - `Skeleton.tsx` — pulsing gray block, width + height props
9. `frontend/index.html` — update `<title>` to `import.meta.env.VITE_APP_TITLE`, add Inter font preconnect

**Install (one command):**
```bash
cd frontend && npm install clsx tailwind-merge
```

---

## Phase 2 — Auth polish + routing

**Files to create/update:**

10. `frontend/src/components/layout/ProtectedRoute.tsx`
    - Reads `useMe()` result
    - If loading → `<Spinner>`
    - If unauthenticated → `<Navigate to="/login" />`
    - Otherwise → renders children
    - Note: research page is accessible without auth (anonymous), so ProtectedRoute is opt-in per route

11. `frontend/src/components/layout/Header.tsx`
    - Left: Curalink logo + wordmark
    - Right: health status dot (green/red from `/api/v1/health`, polled every 60s) + user name + sign out button
    - If not logged in: show "Sign in" link instead

12. `frontend/App.tsx` — update routes:
    ```
    /           → redirect to /research
    /login      → LoginPage
    /register   → RegisterPage
    /research   → ResearchPage (no auth required)
    /research/:sessionId → ResearchPage (loads session)
    ```

13. `frontend/src/pages/LoginPage.tsx` — polish: use `Button` + `Input` components, add brand logo at top  
14. `frontend/src/pages/RegisterPage.tsx` — same polish

---

## Phase 3 — Research API layer

**Files to create:**

15. `frontend/src/api/research.ts`
    ```typescript
    researchApi.query(body: ResearchRequest)   → POST /research
    researchApi.followup(body: FollowupRequest) → POST /followup (sessionId required)
    researchApi.getSession(id: string)         → GET /session/:id
    researchApi.deleteSession(id: string)      → DELETE /session/:id
    researchApi.health()                       → GET /health
    ```
    `X-Session-Id` response header is read and returned alongside the data.

16. `frontend/src/hooks/useResearch.ts`
    - `useResearch()` — `useMutation` wrapping `researchApi.query`; on success stores `sessionId` in state
    - `useFollowup()` — `useMutation` wrapping `researchApi.followup`

17. `frontend/src/hooks/useSession.ts`
    - `useSessionHistory(id)` — `useQuery` for `GET /session/:id`; enabled only when `id` is set
    - `useDeleteSession()` — `useMutation`; on success clears local session state

---

## Phase 4 — Research UI (core)

**Files to create:**

18. `frontend/src/components/research/QueryForm.tsx`
    - Textarea for free-text message (primary input)
    - Collapsible "Advanced" row: Disease field + Query field + QueryType select + Mode select + Age field
    - QueryType options: `treatment | mechanism | trial | prevention | general`
    - Mode options: `brief | standard | deep | high_quality`
    - Submit button shows `Spinner` while pending
    - Disabled while `isLoading`

19. `frontend/src/components/research/ConditionOverview.tsx`
    - Disease name as heading
    - Evidence level `Badge` (high/moderate/low)
    - Subtypes as small pill badges (if any)
    - Summary paragraph

20. `frontend/src/components/research/InsightCard.tsx`
    - Claim as bold text
    - Detail as gray secondary text
    - Confidence `Badge`
    - Year (if present)
    - Source ref chips — each chip is a small superscript button that scrolls to the source in SourceList
    - If `citationWarning` present → yellow `Alert` strip at bottom of card

21. `frontend/src/components/research/TrialCard.tsx`
    - NCT ID + external link icon → opens `clinicaltrials.gov/study/NCTXXX` in new tab
    - Status badge (RECRUITING = green, COMPLETED = blue, ACTIVE = amber)
    - Phase tag
    - Summary (collapsed to 3 lines, expandable)
    - `relevanceNote` in italic if present

22. `frontend/src/components/research/SourceList.tsx`
    - Section header: "Sources (N)"
    - Collapsed by default, expand on click
    - Each source: refId superscript + title + authors + journal + year + DOI link
    - Citation count badge if > 0

23. `frontend/src/components/research/MetadataBar.tsx`
    - Small gray bar: Retrieved N · Ranked N · Latency Xms · Cache: HIT/MISS · Sources: openalex, pubmed, clinicaltrials
    - Model name tooltip on hover
    - `WarningBanner` if `metadata.warnings` non-empty

24. `frontend/src/components/research/WarningBanner.tsx`
    - Maps warning strings to human-readable messages:
      - `ollama_unreachable` → "AI model offline — showing sources only"
      - `retrieval_error:pubmed` → "PubMed unavailable for this query"
      - `reranker_disabled` → "High-quality reranker coming in v2"
      - `uncited_insight:*` → "Some claims could not be verified against sources"
    - Amber `Alert` with list of active warnings

25. `frontend/src/components/research/ResearchResult.tsx`
    - Composes: `ConditionOverview` + `WarningBanner` + `InsightCard[]` + `TrialCard[]` + `SourceList` + `MetadataBar`
    - Animated entrance (CSS `animate-in fade-in slide-in-from-bottom-4`)

---

## Phase 5 — Session continuity

**Files to create:**

26. `frontend/src/components/session/SessionMessage.tsx`
    - User bubble: query text + timestamp
    - Assistant bubble: `ResearchResult`
    - Stacked vertically per turn

27. `frontend/src/components/session/SessionSidebar.tsx`
    - List of past session IDs (stored in `localStorage` keyed by userId or anon device ID)
    - Each item shows: disease name + first query truncated + relative time
    - Active session highlighted
    - "New research" button at top → clears current session
    - Delete button per session (calls `useDeleteSession`)
    - Sessions are stored client-side as `[{ sessionId, disease, snippet, createdAt }]`

28. `frontend/src/components/session/EmptyState.tsx`
    - Shown when no query has been run yet
    - Heading: "Ask anything about a disease or treatment"
    - 3 example prompt chips (clickable → fills QueryForm)
    - Examples: "Latest DBS treatments for Parkinson's" / "CRISPR therapy for sickle cell" / "Clinical trials for Type 2 diabetes"

29. `frontend/src/pages/ResearchPage.tsx`
    - Layout: `AppShell` with `SessionSidebar` left + main right
    - Main area: `SessionMessage[]` (scrollable) OR `EmptyState`
    - Bottom: `QueryForm`
    - On submit: calls `useResearch` (new session) or `useFollowup` (existing sessionId)
    - Scrolls to bottom after each new result
    - URL updates to `/research/:sessionId` after first query (via `navigate`)

---

## Phase 6 — Loading, errors, empty states

**Files to create/update:**

30. `frontend/src/components/research/ResultSkeleton.tsx`
    - Placeholder shown while `isLoading`
    - Mimics layout: gray heading skeleton + 3 insight skeletons + 2 trial skeletons

31. Error handling in `ResearchPage.tsx`:
    - Axios 422 → show form validation error inline
    - Axios 503 (Ollama down) → `WarningBanner` with "ollama_unreachable" — still show any partial data
    - Axios 429 → "Too many requests — wait a moment"
    - Network error → "Could not reach the server"

32. `frontend/src/components/layout/AppShell.tsx`
    - `Header` + sidebar slot + main slot
    - Sidebar collapsible on mobile (hamburger)
    - Responsive: sidebar hidden below `md`, accessible via overlay

---

## Phase 7 — Deployment config

**Files to create/update:**

33. `frontend/.env.production` — set `VITE_API_BASE_URL` to deployed backend URL

34. `frontend/vite.config.ts` — no proxy block in production (Vite proxy is dev-only; production build uses absolute `VITE_API_BASE_URL`)

35. `frontend/vercel.json` (root or frontend/)
    ```json
    {
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    }
    ```
    SPA fallback — all routes go to `index.html`.

36. Root `docker-compose.yml` — add optional `frontend` service under `dev` profile:
    ```yaml
    frontend:
      profiles: [dev]
      build: { context: ./frontend }
      ports: ["5173:5173"]
      environment:
        - VITE_API_BASE_URL=http://backend:5000
    ```

37. `frontend/Dockerfile` (optional, for containerized deploy)
    ```dockerfile
    FROM node:22-alpine AS builder
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY . .
    RUN npm run build

    FROM nginx:alpine
    COPY --from=builder /app/dist /usr/share/nginx/html
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    EXPOSE 80
    ```

---

## Definition of done (frontend v1)

- [ ] `npm run dev` from `frontend/` serves the app on port 5173; proxy forwards `/api` to backend.
- [ ] Login and register work; JWT stored in httpOnly cookie; `useMe()` returns user after reload.
- [ ] `POST /api/v1/research` fires from QueryForm; result renders with all 5 sections (overview, insights, trials, sources, metadata).
- [ ] `citationWarning` and `metadata.warnings` both surface visually — never silently swallowed.
- [ ] Follow-up query continues the session; second turn stacks below the first in `SessionMessage` list.
- [ ] Session list persists in `localStorage`; switching sessions loads prior turns via `GET /session/:id`.
- [ ] Delete session removes it from sidebar and navigates to `/research`.
- [ ] `tsc -b` clean; no `any` in component props.
- [ ] Production build (`npm run build`) with `VITE_API_BASE_URL` set generates a working `dist/`.
- [ ] Responsive: layout works on 375px mobile (sidebar collapses to overlay).

---

## Build order (file by file)

| # | File | Phase |
|---|---|---|
| 1 | `.env.development`, `.env.production`, `.env.example` | 1 |
| 2 | `src/styles/tokens.css` | 1 |
| 3 | `src/lib/utils.ts` | 1 |
| 4 | `src/types/api.ts` | 1 |
| 5 | `src/api/client.ts` (update) | 1 |
| 6–12 | `src/components/ui/*` (7 files) | 1 |
| 13 | `index.html` (update) | 1 |
| 14 | `src/components/layout/ProtectedRoute.tsx` | 2 |
| 15 | `src/components/layout/Header.tsx` | 2 |
| 16 | `src/App.tsx` (update routes) | 2 |
| 17–18 | `LoginPage.tsx`, `RegisterPage.tsx` (polish) | 2 |
| 19 | `src/api/research.ts` | 3 |
| 20 | `src/hooks/useResearch.ts` | 3 |
| 21 | `src/hooks/useSession.ts` | 3 |
| 22 | `src/components/research/QueryForm.tsx` | 4 |
| 23 | `src/components/research/ConditionOverview.tsx` | 4 |
| 24 | `src/components/research/InsightCard.tsx` | 4 |
| 25 | `src/components/research/TrialCard.tsx` | 4 |
| 26 | `src/components/research/SourceList.tsx` | 4 |
| 27 | `src/components/research/MetadataBar.tsx` | 4 |
| 28 | `src/components/research/WarningBanner.tsx` | 4 |
| 29 | `src/components/research/ResearchResult.tsx` | 4 |
| 30 | `src/components/session/SessionMessage.tsx` | 5 |
| 31 | `src/components/session/SessionSidebar.tsx` | 5 |
| 32 | `src/components/session/EmptyState.tsx` | 5 |
| 33 | `src/pages/ResearchPage.tsx` | 5 |
| 34 | `src/components/research/ResultSkeleton.tsx` | 6 |
| 35 | Error handling in `ResearchPage.tsx` (update) | 6 |
| 36 | `src/components/layout/AppShell.tsx` | 6 |
| 37 | `.env.production` (fill real URL) | 7 |
| 38 | `vercel.json` | 7 |
| 39 | `frontend/Dockerfile` + `nginx.conf` | 7 |
| 40 | Root `docker-compose.yml` (update, optional frontend service) | 7 |
