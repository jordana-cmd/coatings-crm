import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/** One imported PlanHub deal (planhub_details joined to its opportunity). */
export interface ImportedDeal {
  planhubId: string;
  revision: number;
  verdict: string | null;
  importedAt: string;
  updatedAt: string | null;
  projectValueUsd: number | null;
  distanceMiles: number | null;
  opportunityId: string | null;
  projectName: string | null;
  stage: string | null;
  companyName: string | null;
}

/** Latest ship-step run summary — the only source of the crm-inbox pending count. */
export interface ShipStatus {
  ranAt: string;
  foldersFound: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { folder: string; detail: string }[] | null;
}

interface PlanhubRow {
  planhub_id: string;
  revision: number;
  verdict: string | null;
  imported_at: string;
  updated_at: string | null;
  project_value_usd: number | null;
  distance_miles: number | null;
  opportunity_id: string | null;
  opportunities: {
    id: string;
    name: string;
    stage: string;
    companies: { name: string } | null;
  } | null;
}

export function useImports() {
  const [deals, setDeals] = useState<ImportedDeal[]>([]);
  const [shipStatus, setShipStatus] = useState<ShipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!supabase) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }
    setLoading(true);

    const [dealsRes, statusRes] = await Promise.all([
      supabase
        .from("planhub_details")
        .select(
          "planhub_id, revision, verdict, imported_at, updated_at, project_value_usd, distance_miles, opportunity_id, opportunities(id, name, stage, companies(name))",
        )
        .order("imported_at", { ascending: false }),
      supabase
        .from("planhub_ship_status")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (dealsRes.error) {
      setError(dealsRes.error.message);
      setLoading(false);
      return;
    }

    const rows = (dealsRes.data ?? []) as unknown as PlanhubRow[];
    setDeals(
      rows.map((r) => ({
        planhubId: r.planhub_id,
        revision: r.revision,
        verdict: r.verdict,
        importedAt: r.imported_at,
        updatedAt: r.updated_at,
        projectValueUsd: r.project_value_usd,
        distanceMiles: r.distance_miles,
        opportunityId: r.opportunities?.id ?? r.opportunity_id,
        projectName: r.opportunities?.name ?? null,
        stage: r.opportunities?.stage ?? null,
        companyName: r.opportunities?.companies?.name ?? null,
      })),
    );

    const s = statusRes.data;
    setShipStatus(
      s
        ? {
            ranAt: s.ran_at,
            foldersFound: s.folders_found,
            created: s.created,
            updated: s.updated,
            skipped: s.skipped,
            failed: s.failed,
            errors: (s.errors as { folder: string; detail: string }[] | null) ?? null,
          }
        : null,
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { deals, shipStatus, loading, error, refetch: fetch };
}
