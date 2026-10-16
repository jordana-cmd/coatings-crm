-- 00085_harden_advance_stage.sql
-- STEP 2 OF 2. Repoints advance_stage() at the hardened core from 00084.
--
-- APPLY ORDER MATTERS: the cowork-write edge function must already be deployed
-- against cowork_advance_stage before this lands. Until then cowork-write calls
-- advance_stage with the service-role key and no JWT, and this migration is
-- exactly what makes that call start failing with 'Permission denied: no
-- authenticated user'. 00084 → deploy cowork-write → 00085.
--
-- The app path is unaffected: PostgREST always presents the user's JWT, so
-- auth.uid() is populated for every UI-driven advance.
--
-- Behaviour is otherwise byte-identical to the 00076 body — same stage chains,
-- same gate checks, same status coupling, same win-probability table, same
-- stage-history write. The only change is that a NULL actor is now refused
-- instead of silently passing the ownership check.

CREATE OR REPLACE FUNCTION public.advance_stage(p_opp_id uuid, p_target_stage text)
 RETURNS TABLE(id uuid, stage text, status opp_status)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN QUERY SELECT * FROM advance_stage_core(auth.uid(), p_opp_id, p_target_stage);
END; $function$;

GRANT EXECUTE ON FUNCTION public.advance_stage(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (run manually; forward-only repo).
-- Restore the pre-00084 inline body of advance_stage(uuid, text) — it is
-- reproduced verbatim inside advance_stage_core() in 00084, so recover it from
-- there (or from 00076) and swap p_actor back to auth.uid().
-- ─────────────────────────────────────────────────────────────────────────────
