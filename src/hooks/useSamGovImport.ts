import { useState } from "react";
import { supabase } from "../lib/supabase";

/** One SAM.gov preview row, as returned by the sam-gov-search Edge Function. */
export interface SamPreviewItem {
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

export interface SamImportResult {
  solicitationNumber: string;
  opportunityId: string | null;
  error: string | null;
}

interface SearchResponse {
  results: SamPreviewItem[];
  requestsUsed: number;
  errors: { context: string; error: string }[];
}

interface ImportResponse {
  results: SamImportResult[];
  imported: number;
  failed: number;
}

async function invokeError(err: unknown): Promise<string> {
  // FunctionsHttpError carries the JSON error body on err.context
  const e = err as { message?: string; context?: Response };
  try {
    if (e?.context) {
      const body = await e.context.json();
      if (body?.error) return String(body.error);
    }
  } catch {
    // fall through to message
  }
  return e?.message ?? "Request failed";
}

export function useSamGovImport() {
  const [results, setResults] = useState<SamPreviewItem[]>([]);
  const [requestsUsed, setRequestsUsed] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pull = async () => {
    if (!supabase) { setError("Supabase not configured"); return; }
    setSearching(true);
    setError(null);
    setResults([]);
    setRequestsUsed(null);

    const { data, error: err } = await supabase.functions.invoke<SearchResponse>(
      "sam-gov-search",
      { body: { action: "search" } }
    );
    if (err || !data) {
      setError(await invokeError(err));
    } else {
      setResults(data.results);
      setRequestsUsed(data.requestsUsed);
    }
    setSearching(false);
  };

  const importSelected = async (
    items: SamPreviewItem[]
  ): Promise<{ data: ImportResponse | null; error: string | null }> => {
    if (!supabase) return { data: null, error: "Supabase not configured" };
    setImporting(true);

    const { data, error: err } = await supabase.functions.invoke<ImportResponse>(
      "sam-gov-search",
      { body: { action: "import", items } }
    );
    setImporting(false);
    if (err || !data) {
      return { data: null, error: await invokeError(err) };
    }
    // Drop successfully imported rows from the preview
    const importedSols = new Set(
      data.results.filter((r) => r.opportunityId !== null).map((r) => r.solicitationNumber)
    );
    setResults((prev) => prev.filter((r) => !importedSols.has(r.solicitationNumber)));
    return { data, error: null };
  };

  return { results, requestsUsed, searching, importing, error, pull, importSelected };
}
