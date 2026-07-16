// Shared helpers for Edge Functions (claude-extract, claude-score).
// sam-gov-search predates this file and keeps its own copies — don't
// refactor it while it's deployed and working.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.108.2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Validates the caller's JWT and returns a Supabase client scoped to it.
 * All DB reads/writes through this client run under the caller's RLS
 * policies, so reps can only extract/score their own opportunities.
 */
export async function authenticate(
  req: Request
): Promise<{ userClient: SupabaseClient; userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return jsonResponse({ error: "Invalid or expired session" }, 401);
  }
  return { userClient, userId: data.user.id };
}
