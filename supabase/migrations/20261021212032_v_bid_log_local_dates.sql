-- 20261021212032_v_bid_log_local_dates.sql
-- Recovered from supabase_migrations.schema_migrations on 2026-10-22 (applied to production on
-- 2026-10-21 outside the repo). Same view as 20261021202700, with pre-bid and due dates in America/New_York.

create or replace view public.v_bid_log with (security_invoker = true) as
select
  o.name as project,
  coalesce(nullif(concat_ws(', ', co.city, co.state),''), o.job_site_address) as city_state,
  coalesce(gc.name, co.name) as gc_or_owner,
  case when pd.opportunity_id is not null then 'PlanHub'
       when o.pipeline='FEDERAL' then 'SAM.gov'
       when o.pipeline='FACILITY' then 'Direct'
       when o.pipeline='PUBLIC_BID' then 'Public bid'
       else 'GC invite' end as source,
  coalesce(f.solicitation_number, pd.planhub_id) as ref,
  coalesce(e.system, (select string_agg(distinct s.system, ', ') from sub_quotes s where s.opportunity_id=o.id)) as systems,
  e.square_feet as sf,
  (b.prebid_walk_at at time zone 'America/New_York')::date as prebid_date,
  (coalesce(b.bid_due_at, f.response_deadline) at time zone 'America/New_York')::date as bid_due,
  case when o.status='OPEN' then initcap(replace(o.stage,'_',' ')) else initcap(o.status::text) end as status,
  o.amount as mcfc_bid,
  (select s.amount::text || ' (' || s.sub_name || ')' from sub_quotes s where s.opportunity_id=o.id order by s.received_at desc nulls last limit 1) as sub_quote,
  (select c.amount from competitor_bids c where c.opportunity_id=o.id and c.is_winner order by c.created_at desc limit 1) as winning_bid,
  o.next_step as next_action,
  o.drive_folder_url as drive_folder,
  o.created_at::date as date_added,
  o.updated_at::date as last_updated,
  (select left(a.note, 200) from activities a where a.opportunity_id=o.id order by a.logged_at desc limit 1) as notes,
  o.status::text as sort_status,
  o.pipeline::text as pipeline,
  o.id as opportunity_id
from opportunities o
left join bids b on b.opportunity_id=o.id
left join companies gc on gc.id=b.gc_company_id
left join companies co on co.id=o.company_id
left join federal_details f on f.opportunity_id=o.id
left join planhub_details pd on pd.opportunity_id=o.id
left join lateral (select e.system, e.square_feet from estimates e where e.opportunity_id=o.id and e.status<>'SUPERSEDED' order by e.created_at desc limit 1) e on true
where o.status in ('OPEN','NURTURE')
   or (o.status in ('WON','LOST') and coalesce(o.decided_at, o.updated_at) > now() - interval '120 days');
