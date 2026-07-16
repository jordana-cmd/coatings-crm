# Coatings CRM — Project Instructions

## Repo, machines, and workflow (post-migration, current)

### Repo and remote
- Source of truth: `github.com/jordana-cmd/coatings-crm` (work account). Remote `origin` must point here.
- The old repo `github.com/jadams-24/coatings-crm` is **DEPRECATED** — never push to it, never add it as a remote.
- Local path is `C:\dev\coatings-crm` on **both** the work machine and the home machine.
- **Never** clone or store this repo inside OneDrive or any other synced folder (sync conflicts corrupt `.git`). Never copy the repo between machines via USB or OneDrive — always `git clone` fresh from `origin` on each machine.

### Two-machine rule (solo dev, work + home)
This repo is developed from two machines. Every session, on either machine:
1. **Pull before you start**: `git pull` (or `git fetch && git status` first if unsure) before making any changes.
2. **Push before you stop**: push your commits before ending the session, so the other machine can pick up from a synced state.
3. If a push is rejected with "fetch first" / non-fast-forward: `git pull --rebase`, resolve any conflicts, then push. Do not force-push to reconcile.

### Environment (`.env.local`)
- `.env.local` is gitignored and machine-local — it is never committed, and must be recreated independently on each machine after a fresh clone.
- It must contain exactly:
  ```
  VITE_SUPABASE_URL=https://xeykiicwwemecwyzmqgy.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon key from Supabase dashboard → Project Settings → API Keys>
  ```
- Never put the `service_role` / secret key in this app — anon key only, client-side.

### Supabase
- Project ref: `xeykiicwwemecwyzmqgy` (org: motorcityfloorsandcoatings). Any other project ref found in code, docs, or scripts is stale and must be updated.
- CLI link command: `supabase link --project-ref xeykiicwwemecwyzmqgy`.
- Migrations only run from a machine where the `supabase` CLI is logged in and linked — check before running `supabase db push`.

### Deployment
- Vercel deploys from `master` on the `jordana-cmd/coatings-crm` repo.
- Env var changes go in Vercel dashboard → Settings → Environment Variables, and require a **redeploy** to take effect — updating the dashboard alone does not update a live deployment.

### Branch state
- `master`: default branch, deploys to production via Vercel.
- `govcon-federal-pipeline`: active in-progress feature work (GovCon/FEDERAL pipeline). Merging to `master` triggers a production deploy — only merge when it's actually ready to ship, not just to sync work.

## M1 locked decisions

### Hosting
- DB/auth/storage: hosted Supabase, project ref `xeykiicwwemecwyzmqgy`. Migrations pushed via `supabase db push`; no local Docker stack.
- Frontend: Vercel (later, M2+).

### Supabase key format
- Browser uses the **Publishable key** (`sb_publishable_...`). The **Secret key** (`sb_secret_...`) is server-only, bypasses RLS, never goes in client code or the repo.

### Stage values (SCREAMING_SNAKE, exact sets)
```
PUBLIC_BID: SOURCED, ESTIMATING, SUBMITTED, AWARDED, LOST
GC_CHASE:   ON_THE_LIST, QUOTING, CARRIED, GC_AWARDED, WON, LOST
FACILITY:   ENGAGED, SITE_WALK, PROPOSAL, APPROVAL, WON, LOST, NURTURE
FEDERAL:    INTAKE, EXTRACTION, SCORING, ESTIMATING, SUBMITTED, AWARDED, LOST
```
M3 TS pipeline definitions MUST use these exact literals.

### Status enum
```
OPEN, WON, LOST, NURTURE, DISQUALIFIED
```

### CRITICAL: AWARDED <-> STATUS coupling (PUBLIC_BID + FEDERAL)
Both PUBLIC_BID and FEDERAL use `AWARDED` as their terminal win STAGE, but a win is recorded as `STATUS = WON`.
The advance logic MUST set `status = WON` when a PUBLIC_BID or FEDERAL opp reaches stage `AWARDED`.
The win-rate dashboard reads STATUS, not stage — miss this and wins never count.

### go_no_go and invited placement
Both live on `bids` (the 1:1 extension table), NOT on `opportunities`.
This is a documented deviation from the spec's "on the opp" annotation.
Rationale: pipeline-specific flags belong on extension tables (same pattern as gc_carried_us, gc_company_id).

### Extension-row existence rule
"bids iff PUBLIC_BID/GC_CHASE; facility_details iff FACILITY; federal_details iff FEDERAL."
- DB-enforced (one direction): guard triggers reject wrong-pipeline inserts.
- APP-enforced (other direction): the opp-create code path must insert the opp AND its extension row in ONE transaction. There is no DB trigger that auto-creates the extension row.

### FEDERAL pipeline — GovCon module
- Extension table: `federal_details` (SAM.gov identity, Claude extraction/scoring fields, estimate, submission tracking)
- Server-side functions: Supabase Edge Functions (`sam-gov-search`, `claude-extract`, `claude-score`)
- Secrets: `SAM_GOV_API_KEY`, `ANTHROPIC_API_KEY` (set via `supabase secrets set`)
- SAM.gov deduplication key: `federal_details.sam_notice_id`
