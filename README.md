# Frido — Product Intelligence & Prize Sticker Matching

Internal enterprise platform that matches Frido Item Master CSV records against the permanent
DOCX prize-sticker library, enforces human review for uncertain evidence, and produces real PDF
reports from persisted, auditable data.

This repository started as a frontend prototype. It has been upgraded in place (Next.js App Router
was **not** replaced with Vite) to a persisted, authenticated, tested application.

---

## 1. Architecture

```
src/
  app/
    (workspace)/                  Workspace shell (single-user stage; sign-in removed)
      page.tsx                    Overview dashboard
      upload/ matching-results/ review-matches/
      sticker-library/ batch-history/ reports/ settings/
    api/
      auth/login, auth/logout     Session issue/revoke
      bootstrap                   Initial workspace payload
      batches (POST upload)       CSV ingestion → engine → persistence
      batches/[id]                Batch detail + ?format=csv|errors downloads
      matches/[id]/review         Approve / reject / defer / mark unmatched
      matches/bulk-approve        Safe bulk approval
      stickers                    Library listing + DOCX import (SUPER_ADMIN)
      mappings                    Explicit family mapping (SUPER_ADMIN)
      reports, reports/[id]/pdf   Report records + real PDF streaming
      preferences, users, system  Profile, administration, health
  components/                     Existing design system (layout, shared, matching, reports…)
  context/FridoStoreContext.tsx   API-backed workspace store (no mock business state)
  db/schema.ts                    Drizzle schema (15 tables, FKs, indexes, enums)
  db/seed.ts                      Demonstration seed via the production pipeline
  lib/csv.ts                      PapaParse ingestion + validation + error report
  server/matching/engine.ts       Deterministic, fail-closed matching engine (pure)
  server/docx/extract.ts          Real DOCX extraction with mammoth
  server/reports/pdf.ts           Real PDF generation with PDF-lib
  server/repository.ts            Transactions, review decisions, audit, reports
  server/auth.ts                  scrypt hashing, hashed sessions, role guards
```

### Persistence model (PostgreSQL / Drizzle)

`users`, `sessions`, `sticker_documents`, `sticker_references`, `product_family_mappings`,
`csv_batches`, `imported_products`, `match_results`, `review_decisions`, `audit_events`,
`reports`, `processing_runs` — with foreign keys, unique constraints (email, session token hash,
batch code, report code) and indexes (batch, product code, sticker identifier, status).

Migrations: schema is applied with `npx drizzle-kit push` (config: `drizzle.config.json`).
Batches are immutable: each upload inserts a new batch plus its products, match results and
`processing_runs` row. Reviewer decisions are appended to `review_decisions` and `audit_events`;
nothing is overwritten.

---

## 2. Matching rules (engine `2.0.0`, fail-closed)

| Rule | Behaviour | Never |
| --- | --- | --- |
| R1 | Exact approved product-to-sticker mapping (human-approved row) | confirms only when the reference is complete and MRP does not contradict |
| R2 | Exact verified identifier (product code **or** scan identifier) | confirm on identifier collisions — those become conflicts |
| R3 | Explicit approved product-family mapping (wildcard pattern approved by admin) | confirm when colour/size differs (downgraded to review) |
| R4 | Attribute-based candidate (family, prefix, name tokens) | **never** auto-confirm; multiple incompatible families → conflict |
| R5 | No sufficiently relevant candidate | enter a review queue |

Every result stores `rule_id`, `rule_applied`, `engine_version`, evidence codes
(`E-EXACT-IDENTIFIER`, `C-MRP-MISMATCH`, `C-DUPLICATE-IDENTIFIER`, `W-STICKER-INCOMPLETE`, …),
attribute-by-attribute alignment, conflict warnings and the reviewer decision history.

Incomplete sticker extraction, missing MRP evidence and internally conflicted documents always
block automatic confirmation.

---

## 3. What is genuinely implemented

**Data pipeline**
- PapaParse ingestion: UTF-8 BOM, quoted commas, quoted multiline fields, delimiter detection.
- Full Item Master field set preserved (category code → catalog category, prices, dimensions,
  scan identifier, component product code); unknown columns kept in the raw row payload.
- Row validation (missing code/name, invalid or missing MRP, duplicate product codes) with
  rejected rows stored separately and a downloadable CSV error report.
- Real DOCX extraction with mammoth (tables + labelled text): identifier, product/common name,
  net quantity, dimensions, mfg month/year, batch number, packaged/marketed by, country of origin,
  MRP, customer care; missing fields, duplicate identifiers and contradictory MRP values are
  flagged, never resolved automatically.
- Deterministic engine with rule/evidence output and unit tests.
- Transactional batch ingestion + processing run + audit events.

**Brand intro (`src/components/layout/IntroLoader.tsx`)**
- Polished Frido logo reveal animation on signature yellow background (`#FCD10C`) using Framer Motion.
- Static Frido logo fallback screen if animation initialization fails.
- Hard ceiling (6 s), skip button, Escape key, reduced-motion path, guarded `sessionStorage`, and a
  seen-flag written only after completion/skip. Development-only diagnostics panel reports the
  state, mode, and outcome.
- Session-scoped replay available at any time from Settings or the Top Bar.

**Workflow**
- Access control via `requireUser` / `requireAdmin` on every API. The login screen is currently
  removed: without a session, requests resolve to the active workspace owner (SUPER_ADMIN
  preferred) so audit records stay attributed to a real user. Password hashing (scrypt) and hashed
  sessions remain implemented; set `AUTH_REQUIRED=1` and restore `/login` to enforce sign-in.
- Review decisions persisted with reviewer identity, previous/new status, selected reference,
  note and timestamp. Approval without a valid reference returns HTTP 422.
- Bulk approval is per-item verified; items lacking a reference are skipped and reported.
- Real PDF generation (PDF-lib): letterhead, batch metadata, summary blocks, paginated tables
  with repeated headers, reviewer notes and page numbers. Served from
  `GET /api/reports/:code/pdf`.
- Original CSV re-download and import-error download per batch.
- Admin settings: system health counts, user/role listing, DOCX reference import, rule catalogue.
- First-launch brand intro: polished Frido logo animation on signature yellow background, skip control, Escape, reduced-motion handling, and session-scoped replay from Settings or the Top Bar.
  The intro is marked as seen only after it completes or is skipped.

## 4. Demonstration data (explicitly labelled)

`src/db/seed.ts` creates two users, 39 **demonstration** sticker references
(`document_source = seed_demo`) and four CSV batches. The batches go through the real parser and
engine; classifications, conflicts, review decisions, audit events and reports are real database
rows. Demonstration references are labelled in the Sticker Library and should be replaced by the
official DOCX files via Sticker Library → *Import reference DOCX*.

## 5. Still missing / not claimed

- Official Frido DOCX prize stickers and product photography/video were not supplied. The intro
  ships generated studio stills; a real product commercial must be dropped in and wired through
  `NEXT_PUBLIC_FRIDO_INTRO_VIDEO`.
- Sign-in is disabled (single-user stage): no corporate SSO, password reset or invitation flow,
  and user management is read-only. Role separation is still enforced by the API layer.
- Notification preferences are stored but email delivery is not implemented.
- CSV processing is synchronous per request. Very large catalogues should move to a queued worker
  (a `processing_runs` table already supports this).
- Family mappings are managed through the audited `POST /api/mappings` API; there is no mapping
  editor UI yet.
| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_REQUIRED` | no | `1` re-enables enforced sign-in once `/login` is restored |

No secrets are read on the client. API keys are never exposed.

## 7. Required external assets

- Official Frido DOCX prize stickers (Sticker Library → *Import reference DOCX*).
- Existing isolated logo SVGs in `public/images/`.

## 8. Run locally

```bash
npm install
# .env → DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
npx drizzle-kit push --config drizzle.config.json --force   # apply schema
npx tsx src/db/seed.ts                                      # demonstration workspace (optional)
npm run dev                                                 # or: npm run build && npm start
```

The workspace opens directly (no sign-in) and operates as the seeded SUPER_ADMIN
(`admin@myfrido.com`); the employee account `ops@myfrido.com` remains in the database for role
testing. Reseed with `SEED_FORCE=1 npx tsx src/db/seed.ts`.

## 9. Verification performed

- Loader verified: workspace skeleton until the bootstrap payload resolves, error state with retry
  on API failure, intro skip/Escape/reduced-motion paths, intro never blocks app access.
- `npx vitest run` — 51 tests passing across 5 suites: CSV ingestion (9), matching engine +
  evidence truthfulness (23), DOCX extraction on generated `.docx` fixtures (6), PDF generation
  and pagination (4), intro asset-resolution fallback matrix (9).
- `npx next typegen`, `tsc --noEmit`, `npm run build` — pass.
- `build_and_start` health check green; routes and downloads verified with curl, including an
  authenticated login → bootstrap → PDF → CSV upload round trip.

Known limitations are listed in section 5 and are deliberately not presented as working features.
