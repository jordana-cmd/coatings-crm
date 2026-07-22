# cowork-write API

Token-authed server-side write path for the Cowork agent. Fronts CRM RPCs — no direct table writes.
All actions act as a single designated owner (`COWORK_WRITE_OWNER_ID`), so no user identity is sent.

- **Endpoint:** `POST https://xeykiicwwemecwyzmqgy.supabase.co/functions/v1/cowork-write`
- **Auth header:** `X-Cowork-Token: <PLACEHOLDER>` (must equal the `COWORK_WRITE_TOKEN` secret)
- **Content-Type:** `application/json`
- **Envelope:** every response is `{ "ok": boolean, "action": string, "result"?: object, "error"?: string }`

### Status codes
| code | when |
|---|---|
| 200 | action ran (`ok:true`), or an RPC/gate rejection (`ok:false` with `error`) |
| 400 | bad JSON, missing/invalid fields, unknown action, or an RPC error (incl. gate rejection) |
| 401 | missing or wrong `X-Cowork-Token` |
| 500 | `COWORK_WRITE_TOKEN` / `COWORK_WRITE_OWNER_ID` not configured |

---

## Action: `create_opportunity`

Creates an opportunity + its pipeline extension row, resolving the company in the same transaction.
Company reference is either an existing `company_id`, or fields for find-or-create (on `lower(email)`;
for FEDERAL without email, the agency is matched by name + `GOVERNMENT_AGENCY`).

**FEDERAL requires `solicitation_number`** and is deduped on it: an existing federal opp with that
number returns `result.status = "exists"` (no insert); otherwise `"created"`.

```jsonc
{
  "action": "create_opportunity",
  "name": "Warren DPW Salt Barn Floor",          // required
  "pipeline": "GC_CHASE",                          // PUBLIC_BID | GC_CHASE | FACILITY | FEDERAL
  "job_site_address": "1 City Blvd, Warren, MI",   // required
  "amount": 48000,                                 // optional (our bid)
  // company — one of:
  "company_id": "…uuid…",                          // existing company, OR ↓ find-or-create:
  "company_name": "Acme GC",
  "company_type": "GC",                            // optional; default GC (GOVERNMENT_AGENCY for FEDERAL)
  "company_email": "bids@acme.com",                // upsert key (lower(email))
  "company_region": "MI",                          // optional; default MI (US for FEDERAL)
  "company_address": "…",                          // optional; default "Unknown (set in CRM)"
  // FEDERAL only:
  "solicitation_number": "W912...-24-R-0001"       // required for pipeline=FEDERAL
}
```

**Success** → `{"ok":true,"action":"create_opportunity","result":{"status":"created"|"exists","opportunityId":"…","companyId":"…"}}`

```bash
curl -sX POST "$URL/cowork-write" \
  -H "Content-Type: application/json" -H "X-Cowork-Token: <PLACEHOLDER>" \
  -d '{"action":"create_opportunity","name":"Warren DPW Salt Barn Floor","pipeline":"GC_CHASE","job_site_address":"1 City Blvd, Warren, MI","amount":48000,"company_name":"Acme GC","company_email":"bids@acme.com"}'
```

---

## Action: `log_activity`

Logs one activity/task on an opportunity as the designated owner. Fires the contact-touch trigger.

```jsonc
{
  "action": "log_activity",
  "opportunity_id": "…uuid…",                      // required
  "type": "CALL",                                  // required: CALL | VISIT | PREBID_WALK | EMAIL | NOTE
  "note": "Left VM with estimator",                // optional
  "next_action": "Follow up on bid form",          // optional
  "next_action_at": "2026-08-01"                    // optional (date)
}
```

**Success** → `{"ok":true,"action":"log_activity","result":{"activityId":"…"}}`

```bash
curl -sX POST "$URL/cowork-write" \
  -H "Content-Type: application/json" -H "X-Cowork-Token: <PLACEHOLDER>" \
  -d '{"action":"log_activity","opportunity_id":"…","type":"CALL","note":"Left VM","next_action":"Follow up","next_action_at":"2026-08-01"}'
```

---

## Action: `advance_stage`

Advances an opportunity through the stage machine (`advance_stage` RPC). `target_stage` is passed
through **untransformed** — use the exact SCREAMING_SNAKE literal for the pipeline. Gate rejections and
invalid transitions come back verbatim in `error` so the caller sees why.

```jsonc
{
  "action": "advance_stage",
  "opportunity_id": "…uuid…",                      // required
  "target_stage": "BIDDING"                         // required, exact literal
}
```

**Success** → `{"ok":true,"action":"advance_stage","result":{"id":"…","stage":"BIDDING","status":"OPEN"}}`
**Gate rejection** → `{"ok":false,"action":"advance_stage","error":"Gate blocked: Bid amount entered; Estimate file uploaded"}` (HTTP 400)

```bash
curl -sX POST "$URL/cowork-write" \
  -H "Content-Type: application/json" -H "X-Cowork-Token: <PLACEHOLDER>" \
  -d '{"action":"advance_stage","opportunity_id":"…","target_stage":"BIDDING"}'
```

Valid stages per pipeline (see `ARCHITECTURE.md` §5):
`PUBLIC_BID` SOURCED→BIDDING→ESTIMATED→SUBMITTED→AWARDED|LOST ·
`GC_CHASE` QUALIFIED→BIDDING→ESTIMATED→SUBMITTED→GC_AWARDED→WON|LOST ·
`FACILITY` ENGAGED→SITE_WALK→PROPOSAL→APPROVAL→WON|LOST ·
`FEDERAL` INTAKE→EXTRACTION→SCORING→ESTIMATING→SUBMITTED→AWARDED|LOST.

---

## Error shapes

| result | example |
|---|---|
| bad token | `401 {"ok":false,"action":"","error":"Invalid or missing token"}` |
| unknown action | `400 {"ok":false,"action":"frobnicate","error":"unknown action: frobnicate"}` |
| missing field | `400 {"ok":false,"action":"create_opportunity","error":"name, pipeline, and job_site_address are required"}` |
| FEDERAL w/o solicitation | `400 {"ok":false,"action":"create_opportunity","error":"p_solicitation_number is required for FEDERAL opportunities (SAM dedup invariant…)"}` |
| duplicate federal | `200 {"ok":true,"action":"create_opportunity","result":{"status":"exists","opportunityId":"…"}}` |
