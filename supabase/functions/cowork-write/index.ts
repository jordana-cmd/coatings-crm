// cowork-write
// Token-authed server-side write path for the Cowork agent. Fronts existing RPCs — never writes
// tables directly. Three actions: create_opportunity, log_activity, advance_stage.
// Auth: X-Cowork-Token vs COWORK_WRITE_TOKEN. Acts as COWORK_WRITE_OWNER_ID. Deployed --no-verify-jwt.

import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { corsHeaders, jsonResponse } from "../_shared/edge.ts";

const TOKEN_ENV = "COWORK_WRITE_TOKEN";
const OWNER_ENV = "COWORK_WRITE_OWNER_ID";
const ACTIVITY_TYPES = ["CALL", "VISIT", "PREBID_WALK", "EMAIL", "NOTE"] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

interface CreateOppBody {
  action: "create_opportunity";
  name?: string;
  pipeline?: string;
  job_site_address?: string;
  amount?: number | null;
  company_id?: string;
  company_name?: string;
  company_type?: string;
  company_email?: string;
  company_region?: string;
  company_address?: string;
  solicitation_number?: string;
}
interface LogActivityBody {
  action: "log_activity";
  opportunity_id?: string;
  type?: string;
  note?: string;
  next_action?: string;
  next_action_at?: string;
}
interface AdvanceBody {
  action: "advance_stage";
  opportunity_id?: string;
  target_stage?: string;
}
type Body = CreateOppBody | LogActivityBody | AdvanceBody | { action?: string };

interface CreateRow { status: string; opportunity_id: string; company_id: string }
interface StageRow { id: string; stage: string; status: string }

/** Structured single-line logs — never include the token or any secret. */
function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...data }));
}

function first<T>(data: unknown): T | null {
  return (Array.isArray(data) ? (data[0] ?? null) : data) as T | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get(TOKEN_ENV);
  if (!token) return jsonResponse({ ok: false, action: "", error: `${TOKEN_ENV} is not set` }, 500);

  const provided = req.headers.get("X-Cowork-Token");
  if (!provided || provided !== token) {
    return jsonResponse({ ok: false, action: "", error: "Invalid or missing token" }, 401);
  }

  const owner = Deno.env.get(OWNER_ENV);
  if (!owner) return jsonResponse({ ok: false, action: "", error: `${OWNER_ENV} is not set` }, 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse({ ok: false, action: "", error: "Request body must be JSON" }, 400);
  }
  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "create_opportunity") {
      const b = body as CreateOppBody;
      if (!b.name || !b.pipeline || !b.job_site_address) {
        return jsonResponse({ ok: false, action, error: "name, pipeline, and job_site_address are required" }, 400);
      }
      const { data, error } = await admin.rpc("cowork_create_opportunity", {
        p_owner: owner,
        p_name: b.name,
        p_pipeline: b.pipeline,
        p_job_site_address: b.job_site_address,
        p_amount: b.amount ?? null,
        p_company_id: b.company_id ?? null,
        p_company_name: b.company_name ?? null,
        p_company_type: b.company_type ?? null,
        p_company_email: b.company_email ?? null,
        p_company_region: b.company_region ?? null,
        p_company_address: b.company_address ?? null,
        p_solicitation_number: b.solicitation_number ?? null,
      });
      if (error) {
        logEvent("cowork_write", { action, error: error.message });
        return jsonResponse({ ok: false, action, error: error.message }, 400);
      }
      const row = first<CreateRow>(data);
      logEvent("cowork_write", { action, status: row?.status, opportunityId: row?.opportunity_id });
      return jsonResponse({
        ok: true,
        action,
        result: { status: row?.status, opportunityId: row?.opportunity_id, companyId: row?.company_id },
      });
    }

    if (action === "log_activity") {
      const b = body as LogActivityBody;
      if (!b.opportunity_id || !b.type) {
        return jsonResponse({ ok: false, action, error: "opportunity_id and type are required" }, 400);
      }
      if (!ACTIVITY_TYPES.includes(b.type as ActivityType)) {
        return jsonResponse({ ok: false, action, error: `type must be one of: ${ACTIVITY_TYPES.join(", ")}` }, 400);
      }
      const { data, error } = await admin.rpc("cowork_log_activity", {
        p_owner: owner,
        p_opportunity_id: b.opportunity_id,
        p_type: b.type,
        p_note: b.note ?? null,
        p_next_action: b.next_action ?? null,
        p_next_action_at: b.next_action_at ?? null,
      });
      if (error) {
        logEvent("cowork_write", { action, error: error.message });
        return jsonResponse({ ok: false, action, error: error.message }, 400);
      }
      logEvent("cowork_write", { action, activityId: data });
      return jsonResponse({ ok: true, action, result: { activityId: data as string } });
    }

    if (action === "advance_stage") {
      const b = body as AdvanceBody;
      if (!b.opportunity_id || !b.target_stage) {
        return jsonResponse({ ok: false, action, error: "opportunity_id and target_stage are required" }, 400);
      }
      const { data, error } = await admin.rpc("advance_stage", {
        p_opp_id: b.opportunity_id,
        p_target_stage: b.target_stage, // passed through untransformed
      });
      if (error) {
        // Gate rejections surface here — return verbatim so the caller sees why.
        logEvent("cowork_write", { action, error: error.message });
        return jsonResponse({ ok: false, action, error: error.message }, 400);
      }
      const row = first<StageRow>(data);
      logEvent("cowork_write", { action, stage: row?.stage, status: row?.status });
      return jsonResponse({ ok: true, action, result: row });
    }

    return jsonResponse({ ok: false, action, error: `unknown action: ${action || "(none)"}` }, 400);
  } catch (e) {
    return jsonResponse({ ok: false, action, error: String(e) }, 500);
  }
});
