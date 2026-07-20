// sam-gov-search
// action: "search" (default) — runs the fixed query set against SAM.gov,
//   dedupes, filters out already-imported solicitations, returns a preview.
//   Read-only from the app's perspective except one sam_gov_sync_log row.
// action: "import" — takes an array of selected preview items and imports
//   each via the import_federal_opportunity RPC on the caller's JWT.
//   Per-item failures are reported without failing the batch.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.108.2";

// Production v2 search has no "/prod/" path segment — that segment only
// exists on the deprecated v1 path and the api-alpha.sam.gov test host.
// (Root cause of the 2026-07 zero-results incident: this URL used to have
// "/prod/" here, which SAM.gov rejected with HTTP 400 on every query.)
const SAM_GOV_BASE = "https://api.sam.gov/opportunities/v2/search";

interface SamGovQuery {
  ncode: string;
  title?: string;
  typeOfSetAside?: string;
}

const FLOORING_QUERIES: SamGovQuery[] = [
  { ncode: "238330", title: "flooring" },
  { ncode: "238330", title: "epoxy" },
  { ncode: "238330", title: "concrete coating" },
  { ncode: "238330", title: "concrete polishing" },
  { ncode: "238330", title: "urethane cement" },
  { ncode: "238110", title: "concrete coating" },
  { ncode: "238110", title: "concrete polishing" },
  { ncode: "238390", title: "coating" },
];

// SAM.gov's documented ncode param is max 6 digits — this 2-digit sector
// code is unverified against that constraint and may itself 400 even with
// the URL fixed. Flagged, not changed here: not the reported failure since
// the 6-digit FLOORING_QUERIES failed identically before the URL fix.
const SDVOSB_QUERIES: SamGovQuery[] = [
  { ncode: "23", typeOfSetAside: "SDVOSBC" },
  { ncode: "23", typeOfSetAside: "SDVOSBS" },
  { ncode: "23", typeOfSetAside: "VSA" },
  { ncode: "23", typeOfSetAside: "VSS" },
];

const ALL_QUERIES: SamGovQuery[] = [...FLOORING_QUERIES, ...SDVOSB_QUERIES];

interface PreviewItem {
  solicitationNumber: string;
  noticeId: string | null;
  title: string;
  samUrl: string | null;
  department: string | null;
  office: string | null;
  naicsCode: string | null;
  setAsideType: string | null;
  postedDate: string | null;
  responseDeadline: string | null;
  descriptionText: string | null;
  contractingOfficer: string | null;
  coEmail: string | null;
  coPhone: string | null;
  popCity: string | null;
  popState: string | null;
  popZip: string | null;
  popCountry: string | null;
}

interface RunError {
  context: string;
  query: string | null;
  samStatus: number | null;
  error: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Structured, single-line JSON logs. The only logging path in this function
 * — never log a bare string or the raw query params (api_key must not appear). */
function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...data }));
}

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

interface QueryResult {
  items: Record<string, unknown>[];
  runError: RunError | null;
}

async function runQuery(
  apiKey: string,
  q: SamGovQuery,
  postedFrom: string,
  postedTo: string
): Promise<QueryResult> {
  const params = new URLSearchParams({
    api_key: apiKey,
    ncode: q.ncode,
    active: "Yes",
    limit: "100",
    postedFrom,
    postedTo,
  });
  if (q.title) params.set("title", q.title);
  if (q.typeOfSetAside) params.set("typeOfSetAside", q.typeOfSetAside);

  // Redacted label for logs/errors — never includes api_key.
  const label = `ncode=${q.ncode}${q.title ? ` title=${q.title}` : ""}${q.typeOfSetAside ? ` setAside=${q.typeOfSetAside}` : ""}`;

  try {
    const res = await fetch(`${SAM_GOV_BASE}?${params.toString()}`);
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      logEvent("samgov_request", { query: label, samStatus: res.status, totalRecords: null });
      return {
        items: [],
        runError: {
          context: "search",
          query: label,
          samStatus: res.status,
          error: bodyText ? `HTTP ${res.status}: ${bodyText.slice(0, 300)}` : `HTTP ${res.status}`,
        },
      };
    }
    const json = await res.json();
    const totalRecords = typeof json.totalRecords === "number" ? json.totalRecords : null;
    logEvent("samgov_request", { query: label, samStatus: res.status, totalRecords });
    return {
      items: Array.isArray(json.opportunitiesData) ? json.opportunitiesData : [],
      runError: null,
    };
  } catch (e) {
    logEvent("samgov_request", { query: label, samStatus: null, totalRecords: null, error: String(e) });
    return { items: [], runError: { context: "search", query: label, samStatus: null, error: String(e) } };
  }
}

async function fetchDescription(apiKey: string, descriptionUrl: string): Promise<string | null> {
  try {
    const sep = descriptionUrl.includes("?") ? "&" : "?";
    const res = await fetch(`${descriptionUrl}${sep}api_key=${apiKey}`);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      if (typeof json === "string") return json;
      if (json && typeof json.description === "string") return json.description;
      return JSON.stringify(json);
    }
    return await res.text();
  } catch {
    return null;
  }
}

function deriveDeptOffice(fullParentPathName: unknown): { department: string | null; office: string | null } {
  if (typeof fullParentPathName !== "string" || !fullParentPathName.trim()) {
    return { department: null, office: null };
  }
  const parts = fullParentPathName.split(".").map((p) => p.trim()).filter(Boolean);
  return {
    department: fullParentPathName,
    office: parts.length > 0 ? parts[parts.length - 1] : null,
  };
}

/**
 * SAM.gov placeOfPerformance: city/state/country are {code, name} objects
 * (state.code is the USPS code), zip is a plain string. Parsed defensively —
 * some notices omit the field or individual members.
 */
function placeOfPerformance(pop: unknown): {
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
} {
  if (!pop || typeof pop !== "object") {
    return { city: null, state: null, zip: null, country: null };
  }
  const p = pop as Record<string, unknown>;
  const member = (v: unknown, key: "name" | "code"): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const inner = (v as Record<string, unknown>)[key];
      if (typeof inner === "string" && inner.trim()) return inner.trim();
    }
    return null;
  };
  return {
    city: member(p.city, "name"),
    state: member(p.state, "code"),
    zip: typeof p.zip === "string" && p.zip.trim() ? p.zip.trim() : null,
    country: member(p.country, "code"),
  };
}

function firstContact(pointOfContact: unknown): { name: string | null; email: string | null; phone: string | null } {
  if (!Array.isArray(pointOfContact) || pointOfContact.length === 0) {
    return { name: null, email: null, phone: null };
  }
  const primary =
    pointOfContact.find((c) => c && typeof c === "object" && (c as Record<string, unknown>).type === "primary") ??
    pointOfContact[0];
  const c = primary as Record<string, unknown>;
  return {
    name: typeof c?.fullName === "string" ? c.fullName : null,
    email: typeof c?.email === "string" ? c.email : null,
    phone: typeof c?.phone === "string" ? c.phone : null,
  };
}

interface ImportResult {
  solicitationNumber: string;
  opportunityId: string | null;
  error: string | null;
}

/** Agency company name: top-level department (first path segment), else office. */
function agencyNameFor(item: Partial<PreviewItem>): string | null {
  const dept = typeof item.department === "string" ? item.department : "";
  const first = dept.split(".")[0]?.trim();
  if (first) return first;
  return typeof item.office === "string" && item.office.trim() ? item.office.trim() : null;
}

async function handleImport(
  userClient: SupabaseClient,
  adminClient: SupabaseClient,
  rawItems: unknown
): Promise<Response> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return jsonResponse({ error: "action=import requires a non-empty items array" }, 400);
  }

  const results: ImportResult[] = [];
  for (const raw of rawItems) {
    const item = (raw ?? {}) as Partial<PreviewItem>;
    const sol = typeof item.solicitationNumber === "string" ? item.solicitationNumber : "";
    if (!sol) {
      results.push({ solicitationNumber: "(missing)", opportunityId: null, error: "Missing solicitationNumber" });
      continue;
    }

    // Runs on the caller's JWT: auth.uid() inside the RPC attributes
    // ownership to the importing rep (SECURITY INVOKER).
    const { data, error } = await userClient.rpc("import_federal_opportunity", {
      p_title: item.title ?? "(untitled)",
      p_agency_name: agencyNameFor(item),
      p_solicitation_number: sol,
      p_sam_notice_id: item.noticeId ?? null,
      p_sam_url: item.samUrl ?? null,
      p_department: item.department ?? null,
      p_office: item.office ?? null,
      p_naics_code: item.naicsCode ?? null,
      p_set_aside_type: item.setAsideType ?? null,
      p_posted_date: item.postedDate || null,
      p_response_deadline: item.responseDeadline || null,
      p_description_text: item.descriptionText ?? null,
      p_contracting_officer: item.contractingOfficer ?? null,
      p_co_email: item.coEmail ?? null,
      p_co_phone: item.coPhone ?? null,
      p_pop_city: item.popCity ?? null,
      p_pop_state: item.popState ?? null,
      p_pop_zip: item.popZip ?? null,
      p_pop_country: item.popCountry ?? null,
    });

    results.push({
      solicitationNumber: sol,
      opportunityId: error ? null : (data as string),
      error: error ? error.message : null,
    });
  }

  const imported = results.filter((r) => r.opportunityId !== null).length;

  // Record the import count on the most recent sync-log row (the search
  // run that produced this preview). Best-effort — an import isn't failed
  // over bookkeeping.
  const { data: lastLog } = await adminClient
    .from("sam_gov_sync_log")
    .select("id, new_imported")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastLog) {
    await adminClient
      .from("sam_gov_sync_log")
      .update({ new_imported: (lastLog.new_imported ?? 0) + imported })
      .eq("id", lastLog.id);
  }

  return jsonResponse({ results, imported, failed: results.length - imported });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User-context client: resolves auth.uid() correctly (for the log row's synced_by).
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }
    const userId = userData.user.id;

    // Service-role client: bypasses RLS for the cross-owner dedup check.
    // federal_details RLS scopes reps to their own opportunities — a
    // user-JWT-scoped read here would miss other reps' imports and let
    // the same SAM.gov opportunity get imported twice by different reps.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // no body / not JSON — treat as default search action
    }
    const action = body.action === "import" ? "import" : "search";

    if (action === "import") {
      return await handleImport(userClient, adminClient, body.items);
    }

    // Search path only — the import path never calls SAM.gov.
    const samApiKey = Deno.env.get("SAM_GOV_API_KEY");
    if (!samApiKey) {
      return jsonResponse(
        { error: "SAM_GOV_API_KEY is not set. Run `supabase secrets set SAM_GOV_API_KEY=<key>`." },
        500
      );
    }

    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const postedFrom = fmtDate(oneYearAgo);
    const postedTo = fmtDate(today);

    let requestsUsed = 0;
    let failedQueries = 0;
    const errors: RunError[] = [];
    const rawItems: Record<string, unknown>[] = [];

    for (const q of ALL_QUERIES) {
      const { items, runError } = await runQuery(samApiKey, q, postedFrom, postedTo);
      requestsUsed += 1;
      if (runError) {
        errors.push(runError);
        failedQueries += 1;
      }
      rawItems.push(...items);
    }

    // Every query failed at the request level — SAM.gov itself is down/rejecting
    // us (bad URL, expired key, exhausted quota, etc). Report this as a real
    // error, not a 200 with an empty preview: an all-queries-failed run must
    // never look identical to a genuinely-empty search to the client.
    if (failedQueries === ALL_QUERIES.length) {
      const first = errors[0];
      logEvent("samgov_run_summary", {
        requestsUsed,
        rawResults: 0,
        afterDedupe: 0,
        afterAlreadyImportedFilter: 0,
        finalPreviewCount: 0,
        failedQueries,
        totalErrors: errors.length,
        outcome: "total_failure",
      });
      const naicsCodes = [...new Set(ALL_QUERIES.map((q) => q.ncode))];
      const setAsides = [...new Set(SDVOSB_QUERIES.map((q) => q.typeOfSetAside!))];
      await adminClient.from("sam_gov_sync_log").insert({
        synced_by: userId,
        naics_codes: naicsCodes,
        set_asides: setAsides,
        results_found: 0,
        new_imported: 0,
        requests_used: requestsUsed,
        errors,
      });
      return jsonResponse(
        {
          error: `SAM.gov search failed: all ${ALL_QUERIES.length} queries errored`,
          samStatus: first?.samStatus ?? null,
          query: first?.query ?? null,
          errors,
        },
        502
      );
    }

    // Dedupe across all 12 queries by solicitationNumber (a title can match more than one).
    const bySolicitation = new Map<string, Record<string, unknown>>();
    for (const item of rawItems) {
      const sol = item.solicitationNumber;
      if (typeof sol !== "string" || !sol) continue; // can't dedup/import without one
      if (!bySolicitation.has(sol)) bySolicitation.set(sol, item);
    }

    // Cross-check against existing federal_details.solicitation_number.
    const solicitationNumbers = [...bySolicitation.keys()];
    const existing = new Set<string>();
    if (solicitationNumbers.length > 0) {
      const { data: existingRows, error: existErr } = await adminClient
        .from("federal_details")
        .select("solicitation_number")
        .in("solicitation_number", solicitationNumbers);
      if (existErr) {
        errors.push({ context: "dedup-check", query: null, samStatus: null, error: existErr.message });
      } else {
        for (const row of existingRows ?? []) {
          if (row.solicitation_number) existing.add(row.solicitation_number);
        }
      }
    }

    const newItems = [...bySolicitation.entries()].filter(([sol]) => !existing.has(sol));

    // Fetch descriptions for new items only (never seen before, so worth the extra call).
    const preview: PreviewItem[] = [];
    for (const [sol, item] of newItems) {
      let descriptionText: string | null = null;
      if (typeof item.description === "string" && item.description) {
        descriptionText = await fetchDescription(samApiKey, item.description);
        requestsUsed += 1;
        if (descriptionText === null) {
          errors.push({
            context: `description-fetch:${sol}`,
            query: null,
            samStatus: null,
            error: "Failed to fetch or parse description",
          });
        }
      }

      const { department, office } = deriveDeptOffice(item.fullParentPathName);
      const contact = firstContact(item.pointOfContact);
      const pop = placeOfPerformance(item.placeOfPerformance);

      preview.push({
        solicitationNumber: sol,
        noticeId: typeof item.noticeId === "string" ? item.noticeId : null,
        title: typeof item.title === "string" ? item.title : "(untitled)",
        samUrl: typeof item.uiLink === "string" ? item.uiLink : null,
        department,
        office,
        naicsCode: typeof item.naicsCode === "string" ? item.naicsCode : null,
        // Live API returns typeOfSetAside; docs claim setAsideCode — accept both
        setAsideType:
          typeof item.typeOfSetAside === "string" && item.typeOfSetAside
            ? item.typeOfSetAside
            : typeof item.setAsideCode === "string" && item.setAsideCode
              ? item.setAsideCode
              : null,
        postedDate: typeof item.postedDate === "string" ? item.postedDate : null,
        responseDeadline: typeof item.responseDeadLine === "string" ? item.responseDeadLine : null,
        descriptionText,
        contractingOfficer: contact.name,
        coEmail: contact.email,
        coPhone: contact.phone,
        popCity: pop.city,
        popState: pop.state,
        popZip: pop.zip,
        popCountry: pop.country,
      });
    }

    logEvent("samgov_run_summary", {
      requestsUsed,
      rawResults: rawItems.length,
      afterDedupe: bySolicitation.size,
      afterAlreadyImportedFilter: newItems.length,
      finalPreviewCount: preview.length,
      failedQueries,
      totalErrors: errors.length,
      outcome: "completed",
    });

    // Log the run (visibility into daily SAM.gov request usage, 1000/day limit).
    const naicsCodes = [...new Set(ALL_QUERIES.map((q) => q.ncode))];
    const setAsides = [...new Set(SDVOSB_QUERIES.map((q) => q.typeOfSetAside!))];
    const { error: logError } = await adminClient.from("sam_gov_sync_log").insert({
      synced_by: userId,
      naics_codes: naicsCodes,
      set_asides: setAsides,
      results_found: preview.length,
      new_imported: 0,
      requests_used: requestsUsed,
      errors: errors.length > 0 ? errors : null,
    });
    if (logError) {
      errors.push({ context: "sync-log-insert", query: null, samStatus: null, error: logError.message });
    }

    return jsonResponse({ results: preview, requestsUsed, errors });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
