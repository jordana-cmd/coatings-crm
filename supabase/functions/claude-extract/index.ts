// claude-extract
// Extracts structured fields from a FEDERAL opportunity's SAM.gov
// description text into federal_details, using Claude with structured
// outputs (output_config.format json_schema — guaranteed-parseable JSON).
//
// Body: { opportunity_id: string }
// Status flow: extraction_status PENDING → PROCESSING → COMPLETE | FAILED.
// The INTAKE → EXTRACTION stage gate requires COMPLETE.

import Anthropic from "npm:@anthropic-ai/sdk";
import { authenticate, corsHeaders, jsonResponse } from "../_shared/edge.ts";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "square_footage",
    "system_spec",
    "surface_prep",
    "bond_required",
    "bond_amount",
    "site_visit_date",
    "site_visit_mandatory",
    "wage_determination",
    "magnitude",
    "scope_summary",
  ],
  properties: {
    square_footage: {
      type: ["number", "null"],
      description: "Total square footage of flooring/coating work, if stated. Null if not stated.",
    },
    system_spec: {
      type: ["string", "null"],
      description:
        "The flooring/coating system specified (e.g. 'epoxy with urethane topcoat', 'urethane cement 1/4 inch', 'polished concrete 800 grit'). Null if not specified.",
    },
    surface_prep: {
      type: ["string", "null"],
      description: "Required surface preparation (e.g. 'shot blast to CSP-3', 'diamond grind'). Null if not specified.",
    },
    bond_required: {
      type: "boolean",
      description: "True if a bid bond, performance bond, or payment bond is required.",
    },
    bond_amount: {
      type: ["number", "null"],
      description: "Bond amount in dollars, or percentage converted to null if only a percentage is given without a base amount.",
    },
    site_visit_date: {
      type: ["string", "null"],
      description: "Site visit / pre-bid walk date-time in ISO 8601 format (e.g. '2026-08-01T10:00:00-04:00'). Null if none scheduled or not stated.",
    },
    site_visit_mandatory: {
      type: "boolean",
      description: "True only if the solicitation states the site visit is mandatory.",
    },
    wage_determination: {
      type: ["string", "null"],
      description: "Wage determination reference (e.g. Davis-Bacon WD number) if cited. Null if none.",
    },
    magnitude: {
      type: ["string", "null"],
      description: "Construction magnitude range as stated (e.g. 'Between $100,000 and $250,000'). Null if not stated.",
    },
    scope_summary: {
      type: "string",
      description: "2-3 sentence plain-language summary of the work scope, written for a flooring estimator.",
    },
  },
} as const;

const SYSTEM_PROMPT = `You extract structured data from U.S. federal government solicitations on behalf of a commercial/industrial flooring and coatings contractor (epoxy, urethane cement, resinous systems, concrete polishing).

Rules:
- Extract only what the solicitation actually states. Never guess or infer values that are not present — use null for anything not stated.
- Dollar amounts: numbers only, no currency symbols or commas.
- Dates: ISO 8601. If a date has no time, use the date alone (e.g. '2026-08-01'). If a timezone is stated, include the offset.
- bond_required is true for bid, performance, OR payment bond requirements. site_visit_mandatory is true only when explicitly mandatory.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const { userClient } = auth;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return jsonResponse(
        { error: "ANTHROPIC_API_KEY is not set. Run `supabase secrets set ANTHROPIC_API_KEY=<key>`." },
        500
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // fall through — validated below
    }
    const oppId = typeof body.opportunity_id === "string" ? body.opportunity_id : null;
    if (!oppId) {
      return jsonResponse({ error: "opportunity_id is required" }, 400);
    }

    // RLS on the user client scopes this to the caller's own opportunities.
    const { data: fed, error: fedErr } = await userClient
      .from("federal_details")
      .select("id, description_text, department, office, naics_code, set_aside_type, response_deadline, opportunities(name)")
      .eq("opportunity_id", oppId)
      .maybeSingle();
    if (fedErr) return jsonResponse({ error: fedErr.message }, 500);
    if (!fed) return jsonResponse({ error: "No federal_details row found for this opportunity (or not yours)" }, 404);
    if (!fed.description_text) {
      return jsonResponse({ error: "This opportunity has no description text to extract from" }, 422);
    }

    await userClient
      .from("federal_details")
      .update({ extraction_status: "PROCESSING" })
      .eq("id", fed.id);

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const oppName = (fed.opportunities as unknown as { name: string } | null)?.name ?? "(untitled)";
    const userContent = [
      `Solicitation title: ${oppName}`,
      `Agency: ${fed.department ?? "unknown"}${fed.office ? ` / ${fed.office}` : ""}`,
      `NAICS: ${fed.naics_code ?? "unknown"} | Set-aside: ${fed.set_aside_type ?? "none stated"} | Response deadline: ${fed.response_deadline ?? "unknown"}`,
      "",
      "Full description:",
      fed.description_text,
    ].join("\n");

    let extracted: Record<string, unknown>;
    try {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        output_config: { format: { type: "json_schema", schema: EXTRACTION_SCHEMA } },
        messages: [{ role: "user", content: userContent }],
      });

      if (response.stop_reason === "refusal") {
        throw new Error("Model declined the request (refusal)");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("Extraction output truncated (max_tokens)");
      }
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in model response");
      }
      extracted = JSON.parse(textBlock.text);
    } catch (e) {
      await userClient
        .from("federal_details")
        .update({
          extraction_status: "FAILED",
          extraction_json: { error: String(e) },
        })
        .eq("id", fed.id);
      return jsonResponse({ error: `Extraction failed: ${String(e)}` }, 502);
    }

    const { error: updateErr } = await userClient
      .from("federal_details")
      .update({
        square_footage: extracted.square_footage,
        system_spec: extracted.system_spec,
        surface_prep: extracted.surface_prep,
        bond_required: extracted.bond_required === true,
        bond_amount: extracted.bond_amount,
        site_visit_date: extracted.site_visit_date,
        site_visit_mandatory: extracted.site_visit_mandatory === true,
        wage_determination: extracted.wage_determination,
        magnitude: extracted.magnitude,
        extraction_json: extracted,
        extraction_status: "COMPLETE",
      })
      .eq("id", fed.id);
    if (updateErr) {
      return jsonResponse({ error: `Extracted but failed to save: ${updateErr.message}` }, 500);
    }

    return jsonResponse({ status: "COMPLETE", extracted });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
