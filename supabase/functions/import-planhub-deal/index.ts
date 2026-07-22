// import-planhub-deal
// Token-authed PlanHub ingest. Two content types on one endpoint:
//   application/json      → validate + import one deal (transactional RPC), returns decision.
//   multipart/form-data   → upload one document (opportunityId + file) to Storage, attach idempotently.
// Auth is a shared secret in the X-Import-Token header (NOT a Supabase JWT — deployed --no-verify-jwt).

import { createClient } from "npm:@supabase/supabase-js@2.108.2";

// Fallback import owner if PLANHUB_IMPORT_OWNER_ID isn't set (the sole admin account).
const DEFAULT_OWNER = "e7105063-ac22-403e-b6dc-5418fcdf64c4";
const BUCKET = "opportunity-documents";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-import-token",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Structured single-line logs — never include the token or any secret. */
function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...data }));
}

interface DealJson {
  schema_version?: number;
  source?: string;
  created_at?: string;
  revision?: number;
  deal?: {
    planhub_id?: string;
    project_name?: string;
    bid_due?: string;
    verdict?: string;
    [k: string]: unknown;
  };
  gc?: { company?: string; contact_name?: string; phone?: string; email?: string };
}

interface ImportRow {
  status: "created" | "updated" | "skipped";
  opportunity_id: string;
  revision: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Auth: shared import token ──
  const importToken = Deno.env.get("PLANHUB_IMPORT_TOKEN");
  if (!importToken) {
    return jsonResponse(
      { error: "PLANHUB_IMPORT_TOKEN is not set. Run `supabase secrets set PLANHUB_IMPORT_TOKEN=<token>`." },
      500,
    );
  }
  const provided = req.headers.get("X-Import-Token");
  if (!provided || provided !== importToken) {
    return jsonResponse({ error: "Invalid or missing import token" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const ownerId = Deno.env.get("PLANHUB_IMPORT_OWNER_ID") ?? DEFAULT_OWNER;
  const contentType = req.headers.get("content-type") ?? "";

  try {
    // ── Document upload ──
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const opportunityId = form.get("opportunityId");
      const file = form.get("file");
      if (typeof opportunityId !== "string" || !(file instanceof File)) {
        return jsonResponse({ error: "multipart requires opportunityId (text) and file" }, 400);
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // Deterministic path (no timestamp) so re-POSTing the same file overwrites in place.
      const storagePath = `${opportunityId}/planhub/${safeName}`;
      const bytes = new Uint8Array(await file.arrayBuffer());

      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: true });
      if (upErr) {
        logEvent("planhub_doc", { opportunityId, storagePath, error: upErr.message });
        return jsonResponse({ error: upErr.message }, 500);
      }

      let documentsAttached = 1;
      const { error: insErr } = await admin.from("opportunity_documents").insert({
        opportunity_id: opportunityId,
        file_name: file.name,
        storage_path: storagePath,
        file_size: bytes.byteLength,
        mime_type: file.type || null,
        uploaded_by: ownerId,
      });
      if (insErr) {
        // 23505 = already attached (unique opportunity_id+storage_path) — idempotent, not an error.
        if (insErr.code === "23505") {
          documentsAttached = 0;
        } else {
          logEvent("planhub_doc", { opportunityId, storagePath, error: insErr.message });
          return jsonResponse({ error: insErr.message }, 500);
        }
      }
      logEvent("planhub_doc", { opportunityId, storagePath, documentsAttached });
      return jsonResponse({ opportunityId, storagePath, documentsAttached });
    }

    // ── JSON deal ingest ──
    const payload = (await req.json()) as DealJson;
    const warnings: string[] = [];

    if (payload.schema_version !== 1) {
      return jsonResponse({ error: `unsupported schema_version: ${payload.schema_version}` }, 400);
    }
    const deal = payload.deal;
    if (!deal?.planhub_id) return jsonResponse({ error: "deal.planhub_id is required" }, 400);
    if (!deal?.project_name) return jsonResponse({ error: "deal.project_name is required" }, 400);
    if (!deal?.bid_due) warnings.push("deal.bid_due missing");
    if (!payload.gc?.email) warnings.push("gc.email missing — GC contact not created");

    const { data, error } = await admin.rpc("import_planhub_deal", {
      payload,
      p_owner_id: ownerId,
    });
    if (error) {
      logEvent("planhub_import", { planhubId: deal.planhub_id, error: error.message });
      return jsonResponse({ error: error.message }, 500);
    }
    const row = (Array.isArray(data) ? data[0] : data) as ImportRow;
    logEvent("planhub_import", {
      planhubId: deal.planhub_id,
      revision: row.revision,
      decision: row.status,
    });
    return jsonResponse({
      status: row.status,
      opportunityId: row.opportunity_id,
      planhubId: deal.planhub_id,
      revision: row.revision,
      documentsAttached: 0,
      warnings,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
