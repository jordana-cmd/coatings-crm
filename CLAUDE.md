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
```
M3 TS pipeline definitions MUST use these exact literals.

### Status enum
```
OPEN, WON, LOST, NURTURE, DISQUALIFIED
```

### CRITICAL: PUBLIC_BID AWARDED <-> STATUS coupling
PUBLIC_BID's terminal win STAGE is `AWARDED`, but a win is recorded as `STATUS = WON`.
The advance logic (M3) MUST set `status = WON` when a PUBLIC_BID opp reaches stage `AWARDED`.
The win-rate dashboard reads STATUS, not stage — miss this and PUBLIC_BID wins never count.

### go_no_go and invited placement
Both live on `bids` (the 1:1 extension table), NOT on `opportunities`.
This is a documented deviation from the spec's "on the opp" annotation.
Rationale: pipeline-specific flags belong on extension tables (same pattern as gc_carried_us, gc_company_id).

### Extension-row existence rule
"bids iff PUBLIC_BID/GC_CHASE; facility_details iff FACILITY."
- DB-enforced (one direction): guard triggers reject wrong-pipeline inserts.
- APP-enforced (other direction): the opp-create code path must insert the opp AND its extension row in ONE transaction. There is no DB trigger that auto-creates the extension row.
