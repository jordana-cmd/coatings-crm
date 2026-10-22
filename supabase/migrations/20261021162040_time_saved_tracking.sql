-- 20261021162040_time_saved_tracking.sql
-- Recovered from supabase_migrations.schema_migrations on 2026-10-22 (applied to production on
-- 2026-10-21 outside the repo). Content is the statement recorded at apply time.

create table if not exists public.time_saved_rates (
  task text primary key,
  minutes numeric not null check (minutes >= 0),
  description text not null,
  updated_at timestamptz not null default now()
);
alter table public.time_saved_rates enable row level security;
create policy time_saved_rates_read on public.time_saved_rates for select to authenticated using (true);

insert into public.time_saved_rates (task, minutes, description) values
 ('job_setup',        10, 'New job: CRM record + Drive folder tree created'),
 ('pricing_run',      45, 'Estimate built with the mcfc-pricing calculator (self-perform)'),
 ('msc_pricing',      10, 'MSC quote turned into a priced estimate (÷0.80)'),
 ('msc_request',      30, 'Scope sheet + pricing request draft to MSC'),
 ('proposal_drafted', 30, 'Proposal PDF + Gmail draft to GC'),
 ('sub_quote_logged',  5, 'Sub quote PDF filed and logged'),
 ('proposal_filed',    5, 'Sent proposal filed + stage set to SUBMITTED'),
 ('file_filed',        3, 'Bid PDF / addendum filed to the job folder'),
 ('federal_bid_sheet',90, 'SAM.gov docs downloaded and federal bid sheet written'),
 ('result_found',     15, 'Bid result researched and recorded (win/loss/winner)'),
 ('result_followup',   5, 'Results follow-up email drafted'),
 ('no_bid_closed',     2, 'Stale job closed as No Bid'),
 ('needs_sf_flagged', 10, 'Plans checked for SF / finish and flagged')
on conflict (task) do nothing;

create or replace view public.v_agent_task_events as
select a.logged_at as at, a.opportunity_id,
  case
    when a.note like 'Pipeline: proposal %' then 'proposal_drafted'
    when a.note like 'Pipeline: MSC request drafted%' or a.note like 'Scope sheet drafted to MSC%' then 'msc_request'
    when a.note like 'Pipeline: NEEDS SF%' then 'needs_sf_flagged'
    when a.note like 'Federal Bid Desk:%' then 'federal_bid_sheet'
    when a.note like 'Results chaser: follow-up drafted%' then 'result_followup'
    when a.note ~ '^Results chaser: (WON|LOST|GC_AWARDED)' then 'result_found'
    when a.note like 'Backfill %closed as no-bid%' then 'no_bid_closed'
    when a.note like 'Intake: proposal filed%' then 'proposal_filed'
    when a.note like 'Intake: filed%' then 'file_filed'
  end as task
from public.activities a
where a.note ~ '^(Pipeline:|Scope sheet drafted to MSC|Federal Bid Desk:|Results chaser:|Backfill |Intake:)'
union all
select e.created_at, e.opportunity_id, case when e.source like '%msc%' then 'msc_pricing' else 'pricing_run' end
from public.estimates e where e.source in ('mcfc-pricing','pipeline-self-perform','pipeline-msc-20')
union all
select s.received_at, s.opportunity_id, 'sub_quote_logged' from public.sub_quotes s where s.received_at >= '2026-10-16'
union all
select o.created_at, o.id, 'job_setup' from public.opportunities o where o.created_at >= '2026-10-16' and o.drive_folder_url is not null;

create or replace view public.v_time_saved as
select date_trunc('week', ev.at)::date as week, ev.task, count(*) as events, r.minutes as minutes_each,
       round(count(*) * r.minutes / 60.0, 1) as hours_saved
from public.v_agent_task_events ev join public.time_saved_rates r on r.task = ev.task
where ev.task is not null
group by 1, 2, r.minutes;

create or replace view public.v_time_saved_weekly as
select week, sum(events) as events, round(sum(hours_saved),1) as hours_saved
from public.v_time_saved group by 1 order by 1 desc;

alter view public.v_agent_task_events set (security_invoker = true);
alter view public.v_time_saved set (security_invoker = true);
alter view public.v_time_saved_weekly set (security_invoker = true);
