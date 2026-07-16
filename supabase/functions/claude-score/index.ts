// claude-score
// Scores an extracted FEDERAL opportunity BID / WATCH / PASS against the
// company profile, using Claude with structured outputs.
//
// Body: { opportunity_id: string }
// Requires extraction_status = COMPLETE (scoring reads the extracted fields).
// Status flow: scoring_status PENDING → PROCESSING → COMPLETE | FAILED.
// The EXTRACTION → SCORING stage gate requires COMPLETE.

import Anthropic from "npm:@anthropic-ai/sdk";
import { authenticate, corsHeaders, jsonResponse } from "../_shared/edge.ts";

const SCORING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "score_recommendation",
    "score_reasons",
    "scope_fit",
    "magnitude_fit",
    "geography_fit",
    "set_aside_advantage",
    "agency_advantage",
  ],
  properties: {
    score_recommendation: {
      type: "string",
      enum: ["BID", "WATCH", "PASS"],
      description: "BID: pursue now. WATCH: monitor — could firm up. PASS: not worth pursuing.",
    },
    score_reasons: {
      type: "array",
      items: { type: "string" },
      description: "3-6 short bullet reasons for the recommendation, most important first.",
    },
    scope_fit: {
      type: "number",
      description: "0-100: how closely the work matches resinous flooring / coatings / polishing self-perform scope.",
    },
    magnitude_fit: {
      type: "number",
      description: "0-100: how well the job size fits the company's typical project range.",
    },
    geography_fit: {
      type: "number",
      description: "0-100: how workable the job location is from Metro Detroit.",
    },
    set_aside_advantage: {
      type: "number",
      description: "0-100: competitive advantage from the set-aside type (SDVOSB set-asides score highest).",
    },
    agency_advantage: {
      type: "number",
      description: "0-100: advantage from agency familiarity or agencies known to be contractor-friendly for small primes.",
    },
  },
} as const;

// ── Company profile the scorer evaluates against ──
// Review and tune this — the scoring is only as good as this profile.
const COMPANY_PROFILE = `Company profile (evaluate the opportunity against this):
- Motor City Floors & Coatings — commercial/industrial flooring contractor based in Metro Detroit, Michigan.
- Self-perform scope: resinous flooring systems (epoxy, urethane cement, MMA), concrete coatings, concrete polishing, and associated surface prep. NOT general construction, roofing, painting of walls/structures, or civil work — flooring-adjacent scope only.
- Typical self-perform project size: roughly $25,000 to $500,000. Jobs up to ~$1M are feasible; above that requires teaming and scores lower on magnitude fit.
- Service area: Michigan is home turf; the surrounding Midwest (OH, IN, IL, WI, MN) is workable with travel; beyond that geography fit drops quickly.
- Set-aside status: Service-Disabled Veteran-Owned Small Business (SDVOSB). SDVOSB and VOSB set-asides are a strong competitive advantage; other small-business set-asides are neutral; unrestricted competition is a mild disadvantage.
- Bonding: can bond typical projects in its size range; very large bond requirements on big jobs are a constraint.`;

const SYSTEM_PROMPT = `You are a federal contracting bid/no-bid advisor for a specialty flooring contractor.

${COMPANY_PROFILE}

Scoring guidance:
- scope_fit is the dominant factor: if the work is not flooring/coatings/polishing (or that scope is a small slice of a larger general-construction job), recommend PASS regardless of other factors.
- BID requires strong scope fit AND workable size AND workable geography.
- WATCH fits opportunities that are promising but missing information (no magnitude, vague scope) or marginal on one factor.
- Use the full 0-100 range for the numeric scores; do not cluster everything at 50-80.
- Base the assessment only on the provided data. Reflect missing information as uncertainty in score_reasons and lean toward WATCH rather than guessing.`;

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

    const { data: fed, error: fedErr } = await userClient
      .from("federal_details")
      .select(
        "id, extraction_status, description_text, department, office, naics_code, set_aside_type, response_deadline, square_footage, system_spec, surface_prep, bond_required, bond_amount, site_visit_date, site_visit_mandatory, wage_determination, magnitude, extraction_json, opportunities(name)"
      )
      .eq("opportunity_id", oppId)
      .maybeSingle();
    if (fedErr) return jsonResponse({ error: fedErr.message }, 500);
    if (!fed) return jsonResponse({ error: "No federal_details row found for this opportunity (or not yours)" }, 404);
    if (fed.extraction_status !== "COMPLETE") {
      return jsonResponse(
        { error: `Extraction must be COMPLETE before scoring (currently ${fed.extraction_status}). Run claude-extract first.` },
        422
      );
    }

    await userClient
      .from("federal_details")
      .update({ scoring_status: "PROCESSING" })
      .eq("id", fed.id);

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const oppName = (fed.opportunities as unknown as { name: string } | null)?.name ?? "(untitled)";
    const extractionJson = fed.extraction_json as Record<string, unknown> | null;
    const userContent = [
      `Opportunity: ${oppName}`,
      `Agency: ${fed.department ?? "unknown"}${fed.office ? ` / ${fed.office}` : ""}`,
      `NAICS: ${fed.naics_code ?? "unknown"} | Set-aside: ${fed.set_aside_type ?? "none"} | Response deadline: ${fed.response_deadline ?? "unknown"}`,
      "",
      "Extracted data:",
      `- Square footage: ${fed.square_footage ?? "not stated"}`,
      `- System spec: ${fed.system_spec ?? "not stated"}`,
      `- Surface prep: ${fed.surface_prep ?? "not stated"}`,
      `- Bond required: ${fed.bond_required}${fed.bond_amount ? ` ($${fed.bond_amount})` : ""}`,
      `- Site visit: ${fed.site_visit_date ?? "none"}${fed.site_visit_mandatory ? " (MANDATORY)" : ""}`,
      `- Wage determination: ${fed.wage_determination ?? "none cited"}`,
      `- Magnitude: ${fed.magnitude ?? "not stated"}`,
      `- Scope summary: ${typeof extractionJson?.scope_summary === "string" ? extractionJson.scope_summary : "none"}`,
      "",
      "Full description:",
      fed.description_text ?? "(none)",
    ].join("\n");

    let scored: Record<string, unknown>;
    try {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        output_config: { format: { type: "json_schema", schema: SCORING_SCHEMA } },
        messages: [{ role: "user", content: userContent }],
      });

      if (response.stop_reason === "refusal") {
        throw new Error("Model declined the request (refusal)");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("Scoring output truncated (max_tokens)");
      }
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in model response");
      }
      scored = JSON.parse(textBlock.text);
    } catch (e) {
      await userClient
        .from("federal_details")
        .update({
          scoring_status: "FAILED",
          score_reasons: [`Scoring failed: ${String(e)}`],
        })
        .eq("id", fed.id);
      return jsonResponse({ error: `Scoring failed: ${String(e)}` }, 502);
    }

    const { error: updateErr } = await userClient
      .from("federal_details")
      .update({
        score_recommendation: scored.score_recommendation,
        score_reasons: scored.score_reasons,
        scope_fit: scored.scope_fit,
        magnitude_fit: scored.magnitude_fit,
        geography_fit: scored.geography_fit,
        set_aside_advantage: scored.set_aside_advantage,
        agency_advantage: scored.agency_advantage,
        scoring_status: "COMPLETE",
      })
      .eq("id", fed.id);
    if (updateErr) {
      return jsonResponse({ error: `Scored but failed to save: ${updateErr.message}` }, 500);
    }

    return jsonResponse({ status: "COMPLETE", scored });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
