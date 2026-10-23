-- Nightly re-sync of opportunities.win_probability from v_expected_wins.
-- The model decays with days silent, so the numbers need refreshing even when nothing is edited.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('sync-win-probabilities-nightly')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-win-probabilities-nightly');
-- 5:15am Eastern (09:15 UTC during EDT)
SELECT cron.schedule('sync-win-probabilities-nightly', '15 9 * * *', $$SELECT public.sync_win_probabilities(NULL);$$);
