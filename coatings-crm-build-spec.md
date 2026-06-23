# Concrete Coatings CRM — Build Spec (Claude Code)

> **Type:** Custom application build spec.
> **Goal:** A CRM that (a) a brand-new rep can follow blindly and win, and (b) a veteran runs in near-zero clicks. **Optimize for adoption over feature count.** A perfect CRM nobody updates is worth nothing.
> **Current team:** 1 founder/seller + 2 owners (read/dashboard access). Scaling to a small field team.

---

## 0. Engineering principles (read before coding)

1. **Two-tap logging or it fails.** If logging an activity takes more than two interactions on mobile, reps won't do it and the data is fiction. The quick-log path is a first-class feature, not an afterthought.
2. **Gates over fields.** The app's job is to block a deal from advancing until the things that actually lose deals are true (bid date set, addenda acknowledged, mandatory pre-bid walk done). Everything else is optional capture.
3. **Three pipelines, never blended.** Stages and win-rates are computed *per motion*. A blended hit rate is actively misleading — do not build a "combined pipeline" view.
4. **Don't model money already won.** Retainage, change orders, NTP dates = accounting/PM concerns. Out of scope. (See §10 DO NOT BUILD.)
5. **Mobile-first for the rep, dashboard for the owners.** Different surfaces, different priorities.

---

## 1. Recommended stack (swappable)

Pick what Claude Code is fastest with; these are sane defaults for a small, mobile-first CRM:

- **Frontend:** React + TypeScript, Vite. Tailwind for styling. PWA-enabled (installable on phone, offline-tolerant quick-log queue).
- **Backend:** Node + TypeScript (Fastify or Express) **or** a BaaS (Supabase) to skip boilerplate. Supabase is recommended for solo speed: Postgres + auth + row-level security + realtime out of the box.
- **DB:** Postgres.
- **Auth:** email/password + magic link. Roles: `owner` (read + dashboards), `rep` (full CRUD on own records), `admin` (config).
- **Maps:** Mapbox or Google Maps JS SDK for job-site pins + weekly route view.
- **File storage:** Supabase Storage / S3 for takeoff & plan attachments.
- **Hosting:** Vercel (frontend) + Supabase (backend) — minimal ops.

**Config constants to set at top of repo** (still being finalized by stakeholder):
```
FIRST_MOTION = "PUBLIC_BID"   // pipeline to fully instrument first (assumption)
AVG_DEAL_SIZE = null           // TBD — drives whether bonding gates jobs
GEO_STATES = [28 states east of Mississippi + one tier west]
```

---

## 2. Data model (Postgres schema)

Five core tables. SQL-ish; adapt types to your ORM.

### `companies`
```
id              uuid pk
name            text  not null
type            enum('GC','AWARDING_AUTHORITY','PLANT_OWNER','ARCHITECT') not null
region          text  not null         -- territory/state grouping
address         text  not null
website         text
notes           text
created_at      timestamptz default now()
```

### `contacts`
```
id              uuid pk
company_id      uuid fk -> companies
name            text  not null
role            enum('PM','ESTIMATOR','SUPER','FM','PURCHASING','SPEC_WRITER') not null
phone           text  not null
email           text
is_decision_maker boolean default false
created_at      timestamptz default now()
```

### `opportunities` (the heart — one row per job-per-motion)
```
id                  uuid pk
name                text  not null
pipeline            enum('PUBLIC_BID','GC_CHASE','FACILITY') not null
stage               text  not null     -- validated against pipeline's stage set
amount              numeric            -- required to reach Bid/Proposal stage (gate)
owner_id            uuid fk -> users
company_id          uuid fk -> companies
job_site_address    text  not null     -- doubles as map pin
job_site_lat        numeric
job_site_lng        numeric
project_tag         text               -- links same physical job across pipelines
prevailing_wage     boolean            -- required on bid pipelines (gate)
status              enum('OPEN','WON','LOST','NURTURE') default 'OPEN'
lost_reason         text               -- esp. GC: 'OUR_NUMBER' | 'GC_LOST_PRIME'
revisit_date        date               -- required if status='NURTURE' (facility)
created_at          timestamptz default now()
updated_at          timestamptz
```

### `bids` (1:1 extension of opportunities for PUBLIC_BID + GC_CHASE)
```
id                      uuid pk
opportunity_id          uuid fk -> opportunities (unique)
bid_due_at              timestamptz        -- required to advance past Sourced (gate)
prebid_walk_at          timestamptz
prebid_walk_mandatory   boolean default false
prebid_walk_completed   boolean default false
plans_link              text               -- plan-room URL; required to advance (gate)
addenda_acknowledged    boolean default false   -- required to submit (gate)
bond_required           boolean default false
bond_amount             numeric
bond_arranged           boolean default false
estimate_file_url       text               -- required to submit (gate)
gc_company_id           uuid fk -> companies  -- GC_CHASE only
gc_carried_us           boolean            -- required at 'Carried' stage (gate)
bid_tab_position        int                -- 1 = low; for spread-to-low metric
low_bid_amount          numeric            -- to compute spread
```

### `facility_details` (1:1 extension for FACILITY)
```
id                  uuid pk
opportunity_id      uuid fk -> opportunities (unique)
budget_cycle        text     -- fiscal-year/timing; required to reach Proposal (gate)
decision_maker_id   uuid fk -> contacts   -- required to reach Proposal (gate)
warranty_term       text
square_footage      numeric
survey_completed    boolean default false  -- required to advance past Site Walk (gate)
```

### `activities` (the quick-log target)
```
id              uuid pk
opportunity_id  uuid fk -> opportunities
user_id         uuid fk -> users
type            enum('CALL','VISIT','PREBID_WALK','EMAIL','NOTE') not null
note            text
voice_note_url  text
next_action     text          -- auto-suggested on log
next_action_at  date
logged_at       timestamptz default now()
```

---

## 3. Pipeline state machines + gate logic

Each pipeline is a strict stage list with **exit gates**. Advancing a stage is blocked unless the gate predicate returns true. Build a single `canAdvance(opp, targetStage)` function per pipeline.

### Pipeline A — PUBLIC_BID
```
Stages: Sourced -> Estimating -> Submitted -> Awarded/Lost

GATES:
  Sourced -> Estimating:
    bids.plans_link != null
    AND go_no_go == 'GO'           // simple boolean prompt on the opp
  Estimating -> Submitted:
    bids.addenda_acknowledged == true
    AND opportunities.amount != null
    AND (NOT bids.prebid_walk_mandatory OR bids.prebid_walk_completed == true)
    AND (NOT bids.bond_required OR bids.bond_arranged == true)
    AND bids.estimate_file_url != null
  Submitted -> Awarded/Lost:
    bid_due_at has passed / bid received
```
**Hard red-flag rule:** if `prebid_walk_mandatory == true` AND `prebid_walk_at < now()` AND `prebid_walk_completed == false` → mark opp **DISQUALIFIED** (a missed mandatory walk = legally cannot bid). Surface red on the calendar.

### Pipeline B — GC_CHASE
```
Stages: On the List -> Quoting -> Carried -> GC Awarded -> Won/Lost

GATES:
  On the List -> Quoting:
    invited == true                // boolean on opp
    AND bids.plans_link != null
  Quoting -> Carried:
    quote_delivered == true
    AND logged before gc bid day
  Carried -> GC Awarded:
    bids.gc_carried_us == true
  GC Awarded -> Won:
    sub_po_received == true
  -> Lost:
    REQUIRE opportunities.lost_reason IN ('OUR_NUMBER','GC_LOST_PRIME')   // mandatory
```
**Per-GC rollup:** compute carried-rate and sub-award-conversion grouped by `gc_company_id`. This is how the GC motion compounds — surface it on the GC company record.

### Pipeline C — FACILITY
```
Stages: Engaged -> Site Walk -> Proposal -> Approval -> Won/Lost/Nurture

GATES:
  Engaged -> Site Walk:
    contact made AND budget cycle identified
  Site Walk -> Proposal:
    facility_details.survey_completed == true
    AND facility_details.budget_cycle != null
    AND facility_details.decision_maker_id != null
  Proposal -> Approval:
    proposal_delivered == true
  Approval -> Won:
    po_or_capital_approval == true
  -> Nurture (instead of Lost, when lost to timing):
    REQUIRE opportunities.revisit_date != null   // mandatory — protects highest-margin pipeline from amnesia
```
**Nurture rule:** a facility "no" defaults to NURTURE + forced revisit_date, not LOST. Only allow true LOST when the rep explicitly confirms dead (lost to competitor/scope, not timing).

---

## 4. Screens to build

### Rep — Daily view (default landing, mobile-first, one screen no scroll)
- **Today's bid deadlines** — red, time-stamped, sorted ascending. Tap → opp.
- **Today's site visits / pre-bid walks** — one-tap directions (deep-link to maps).
- **Follow-ups due** — `activities.next_action_at <= today`, tap-to-clear.
- **Hot list** — manually pinned opps.

### Rep — Quick-log (the make-or-break flow)
- Floating action button on every opp → log Call/Visit/Walk in **two taps**.
- Voice-to-note (record → store `voice_note_url`, optional transcription later).
- On save: prompt "next action?" with smart default date by pipeline cadence → writes `next_action` + `next_action_at`. **Logging creates tomorrow's plan.**
- **"Log + Advance"** single action when `canAdvance()` is true.
- Offline queue: if no signal, store locally and sync on reconnect (PWA).

### Rep — Weekly view (planned in <5 min)
- **Map** of the week's `VISIT`/`PREBID_WALK` opps as pins (cluster nearby).
- **Bid-deadline strip** — next 10 days of `bid_due_at`.
- **Stale flags** — opps with no activity past their cadence window.

### Opp detail
- Stage tracker showing the **exit-gate checklist as visible checkboxes** (the gate predicate, made human-readable). This is also the new-rep coaching surface.
- Activity timeline. Attachments (plans link, estimate file). Linked company/contacts.

### Owner dashboard — exactly 4 tiles (do not add more)
1. **Outstanding Bid $** — sum of `amount` where pipeline in (PUBLIC_BID, GC_CHASE) AND stage = Submitted/Carried-or-later AND status = OPEN. Slice by expected award date.
2. **Bid Win Rate by motion** — trailing 90d, computed separately per pipeline.
3. **Average Spread to Low** — avg of `(amount - low_bid_amount)/low_bid_amount` on public bids where tab is known.
4. **% of pipeline requiring a bond** — bonded outstanding $ ÷ total outstanding $.

---

## 5. KPI definitions (build these as computed views)

| KPI | Formula | Notes |
|---|---|---|
| **Bid Win Rate (per motion)** | wins ÷ submitted bids, grouped by pipeline | NEVER blend pipelines |
| **Outstanding Bid $** | Σ amount where status=OPEN & stage≥Submitted/Carried | slice by expected award date |
| **Average Spread to Low** ⭐ | avg((amount − low_bid_amount)/low_bid_amount) | the key pricing read — 3% loss vs 25% loss are different problems |
| **Bid Volume / Week** | count of opps created + submitted per week | leading indicator; catches a quiet funnel |
| **Pre-Bid Walk Completion** | walks completed ÷ walks required | missed mandatory walk = dead bid |
| **GC Carried Rate** | carried ÷ quoted, grouped by gc_company_id | per-GC |
| **Sub-Award Conversion** | sub POs ÷ GC prime wins, per GC | per-GC |
| **% Outstanding $ Requiring Bond** | bonded $ ÷ total outstanding $ | bonding exposure |

**Do NOT build (vanity):** raw activity counts, total unweighted pipeline $, contacts-in-database count, blended cross-motion hit rate.

---

## 6. New-rep coaching layer

Built entirely from data already defined — no separate "training mode."
- **Next-Best-Action card** per opp: derived from stage + days-in-stage + cadence. E.g. facility opp in Site Walk 8 days, no activity → "Schedule the roof walk with [decision_maker.name] — call [phone]." Bid in Estimating, due in 4d, addenda unchecked → "Bid due Thu 2pm. Acknowledge addenda, then lock number."
- **Stage checklist = the exit gate rendered as checkboxes** (already on opp detail). The rep literally sees what must be true to advance.
- **Required-field gates** on the 2–3 fields per pipeline that genuinely gate. Keep it minimal or reps learn to lie.
- **Per-motion playbook** behind a "?" on each pipeline (short half-page: how we win public bids / get on a GC list / run a roof walk).
- **Cadences:** GC → bid-day follow-up reminder; Facility → touch every N days through Approval; Public → addenda re-check at T-minus-3-days.

**Solo-operator nuance:** build the **gates** in MVP (they keep the founder disciplined and future-proof onboarding). Defer the playbook + next-best-action *content* engine to Phase 2 — but the data structure (`next_action`, cadence rules) ships in MVP so quick-log works.

---

## 7. Construction-specific features — ranked

**MUST-HAVE (MVP)**
- Bid calendar with BOTH pre-bid walk date (+ mandatory flag) and bid due date/time.
- Addenda + mandatory-walk gates.
- Plan-room link field; takeoff/estimate file attachment.
- Job-site pins (founder travel planning across ~28 states).

**NICE (Phase 2)**
- Follow-the-GC rollups per GC company.
- Bid-tab capture (spread-to-low intel).
- Bond flag/amount KPI rollup.
- Weekly map route-clustering.

**SKIP / never**
- In-CRM estimating/takeoff engine (attach the file from real estimating software).
- Certified-payroll / prevailing-wage compliance workflow (a flag belongs here; the workflow is accounting/ops).
- Plan-room API auto-sync (brittle, expensive — a pasted link is 90% of the value).
- Change-order / retainage management (PM/accounting system).

---

## 8. Build priority

### MVP (ship first)
- Auth + roles (rep/owner/admin).
- `companies`, `contacts`, `opportunities`, `bids`, `facility_details`, `activities` tables.
- Three pipelines + `canAdvance()` gate logic.
- **Bid calendar** (walk date + mandatory flag + due date/time) with the red disqualification rule.
- **Rep daily view + two-tap quick-log** (with offline queue + next-action capture).
- Opp detail with gate-checklist UI + attachments + plan-room link.
- **4-tile owner dashboard.**

### Phase 2
- Weekly map / route clustering.
- Per-GC relationship rollups.
- Next-best-action content engine + per-motion playbooks.
- Bid-tab / spread-to-low capture + full KPI views.
- Stale-flag automation.

### Later (only if volume justifies)
- Plan-room API sync.
- Estimating-software handshake (auto-attach takeoffs).
- Voice-note transcription.

---

## 9. Data integrity rules to enforce in code
- An opp's `stage` must belong to its `pipeline`'s stage set (validate on write).
- `bids` row exists iff pipeline in (PUBLIC_BID, GC_CHASE); `facility_details` iff pipeline=FACILITY.
- LOST in GC_CHASE requires `lost_reason`.
- NURTURE in FACILITY requires `revisit_date`.
- Advancing stage runs `canAdvance()`; reject with the list of unmet gate conditions (so the UI can show "blocked by: addenda not acknowledged").
- `project_tag` links opps across pipelines but never merges them.

---

## 10. DO NOT BUILD
- Combined/blended cross-pipeline view or blended hit rate.
- In-CRM estimating or quoting engine.
- Certified-payroll / prevailing-wage compliance workflow.
- Change-order, retainage, NTP/scheduling, or any post-award accounting.
- Full document-management system.
- Email / marketing automation & sequences (wrong motion for this business).
- More than 4 owner dashboard tiles.
- New-rep coaching *content* engine before there's a rep to coach (build the gates + data hooks now, defer the content).

---

## 11. Open inputs (resolve while building; don't block MVP)
- [ ] `AVG_DEAL_SIZE` per motion → determines if bonding actually gates jobs.
- [ ] Confirm `FIRST_MOTION` (assumption: PUBLIC_BID — most findable in plan rooms, least relationship-dependent for a solo operator).
- [ ] Sales cycle length per motion → sets cadence intervals.

---

*Guiding principle: **adoption is the only feature that matters.** Two-tap logging, a deadline board you trust, and gates that catch the three things that actually lose deals — missed bid date, unacknowledged addenda / missed mandatory walk, missed GC follow-up. Build those first; everything else is gravy you add once the tool is lived-in.*
