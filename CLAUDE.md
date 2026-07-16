# Coatings CRM — Project Instructions

## M1 locked decisions

### Hosting
- DB/auth/storage: hosted Supabase, project ref `yawqwjttyodyodoqcfbi`. Migrations pushed via `supabase db push`; no local Docker stack.
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
