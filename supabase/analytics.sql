-- À exécuter UNE FOIS dans le SQL Editor du projet Supabase, puis ajouter le compte propriétaire
-- dans analytics_admins (voir docs/analytics/README.md). Rejouable sans effacer les données.
-- Les tables brutes sont privées. L'ingestion accepte des mesures anonymes bornées et idempotentes.
-- Le rapport vérifie auth.uid() côté base, même si l'appelant contourne la page web.

create table if not exists public.analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.analytics_events (
  id uuid primary key,
  visitor uuid not null,
  session uuid not null,
  race uuid,
  at timestamptz not null,
  received_at timestamptz not null default now(),
  event text not null check (event in ('visit','race_start','lap','offtrack','play','race_end')),
  track text,
  car text,
  category text,
  livery smallint,
  mode text,
  control text,
  device text not null,
  version text,
  lap smallint,
  lap_s real,
  clean boolean,
  seconds real not null default 0,
  value smallint not null default 1,
  outcome text
);
create index if not exists analytics_events_at on public.analytics_events(at);
create index if not exists analytics_events_visitor on public.analytics_events(visitor, at);
create index if not exists analytics_events_session on public.analytics_events(session);
create unique index if not exists analytics_visit_unique on public.analytics_events(session) where event='visit';
create unique index if not exists analytics_race_unique on public.analytics_events(race,event) where event in ('race_start','race_end');
create unique index if not exists analytics_lap_unique on public.analytics_events(race,lap) where event='lap';

alter table public.analytics_admins enable row level security;
alter table public.analytics_events enable row level security;
revoke all on public.analytics_admins, public.analytics_events from public, anon, authenticated;
grant all on public.analytics_admins, public.analytics_events to service_role;

create or replace function public.analytics_ingest(p_events jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare e jsonb; stamp timestamptz; v uuid; s uuid; r uuid; accepted integer := 0; n integer;
begin
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>25
    or octet_length(p_events::text)>30000 then
    raise exception 'Invalid analytics batch' using errcode='22023';
  end if;
  for e in select value from jsonb_array_elements(p_events) loop
    begin
      if not (coalesce(e->>'event','') = any(array['visit','race_start','lap','offtrack','play','race_end'])) then continue; end if;
      v := (e->>'visitor')::uuid; s := (e->>'session')::uuid;
      stamp := (e->>'at')::timestamptz; r := (e->>'race')::uuid;
      if v is null or s is null or stamp is null or stamp < now()-interval '7 days'
        or stamp > now()+interval '5 minutes' then continue; end if;
      if not (coalesce(e->>'device','') = any(array['desktop','mobile','tablet'])) then continue; end if;
      if e->>'event'<>'visit' then
        if r is null or coalesce(e->>'track','') !~ '^[a-z0-9_-]{1,40}$'
          or coalesce(e->>'car','') !~ '^[a-z0-9_-]{1,40}$'
          or not (coalesce(e->>'mode','') = any(array['race','timetrial','tuning','multiplayer']))
          or not (coalesce(e->>'category','') = any(array['gt','f1','proto']))
          or not (coalesce(e->>'control','') = any(array['keyboard','wheel','gamepad','touch'])) then continue; end if;
      end if;
      if e->>'event'='lap' and (coalesce((e->>'lap')::integer,0) not between 1 and 999
        or (e->>'lap_s' is not null and not ((e->>'lap_s')::real between 1 and 7200))) then continue; end if;
      if e->>'event'='play' and not (coalesce((e->>'seconds')::real,0) between 0.01 and 60) then continue; end if;
      if e->>'event'='race_end' and not (coalesce(e->>'outcome','')=any(array['completed','abandoned','session_end'])) then continue; end if;
      if e->>'event'='visit' then
        e := e-array['race','track','car','category','livery','mode','control','lap','lap_s','clean','outcome'];
        r := null;
      end if;
      -- Limite atomique par visiteur : ne pas laisser deux requêtes parallèles contourner le quota.
      perform pg_advisory_xact_lock(hashtext(v::text));
      if (select count(*) from public.analytics_events where visitor=v and received_at>now()-interval '1 minute')>=120 then continue; end if;
      insert into public.analytics_events(id,visitor,session,race,at,event,track,car,category,livery,
        mode,control,device,version,lap,lap_s,clean,seconds,value,outcome)
      values ((e->>'id')::uuid,v,s,r,stamp,e->>'event',left(e->>'track',40),left(e->>'car',40),
        left(e->>'category',12),case when e->>'event'<>'visit' then greatest(0,least(99,coalesce((e->>'livery')::integer,0))) end,left(e->>'mode',16),
        left(e->>'control',12),e->>'device',left(e->>'version',20),
        case when e->>'event'='lap' then (e->>'lap')::smallint end,
        case when e->>'event'='lap' then (e->>'lap_s')::real end,
        case when e->>'event'='lap' then (e->>'clean')::boolean end,
        case when e->>'event'='play' then (e->>'seconds')::real else 0 end,
        case when e->>'event'='offtrack' then greatest(1,least(20,coalesce((e->>'value')::integer,1))) else 1 end,
        case when e->>'event'='race_end' then left(e->>'outcome',16) end)
      on conflict do nothing;
      get diagnostics n = row_count; accepted := accepted+n;
    exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow
      or invalid_datetime_format or not_null_violation or check_violation then
      -- Une entrée invalide ne bloque pas la file hors ligne entière.
      continue;
    end;
  end loop;
  return accepted;
end;
$$;
revoke all on function public.analytics_ingest(jsonb) from public;
grant execute on function public.analytics_ingest(jsonb) to anon, authenticated;

create or replace function public.analytics_report(p_from date, p_to date,
  p_track text default null, p_car text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.analytics_admins where user_id=auth.uid()) then
    raise exception 'Analytics access denied' using errcode='42501';
  end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>365 then
    raise exception 'Choose at most 366 days' using errcode='22023';
  end if;
  with
  -- Fenêtre courante + fenêtre précédente de même durée pour les comparaisons.
  scope as materialized (
    select * from public.analytics_events
    where at >= ((p_from-(p_to-p_from+1))::timestamp at time zone 'UTC')
      and at < ((p_to+1)::timestamp at time zone 'UTC')
      and (p_track is null or track=p_track) and (p_car is null or car=p_car)
  ), current_events as materialized (
    select * from scope where at >= (p_from::timestamp at time zone 'UTC')
  ), previous_events as (
    select * from scope where at < (p_from::timestamp at time zone 'UTC')
  ), periods as (
    select 'current' period, * from current_events union all select 'previous', * from previous_events
  ), totals as (
    select period,jsonb_build_object(
      'visitors',count(distinct visitor),'sessions',count(distinct session),
      'starts',count(*) filter(where event='race_start'), 'laps',count(*) filter(where event='lap'),
      'clean_laps',count(*) filter(where event='lap' and clean=true),
      'known_laps',count(*) filter(where event='lap' and clean is not null),
      'completed',count(*) filter(where event='race_end' and outcome='completed'),
      'abandoned',count(*) filter(where event='race_end' and outcome='abandoned'),
      'tt_ended',count(*) filter(where event='race_end' and outcome='session_end'),
      'seconds',coalesce(sum(seconds) filter(where event='play'),0),
      'offtracks',coalesce(sum(value) filter(where event='offtrack'),0)
    ) data from periods group by period
  ), daily as (
    select (at at time zone 'UTC')::date as day,count(distinct visitor) visitors,
      count(distinct session) sessions,count(*) filter(where event='race_start') starts,
      count(*) filter(where event='lap') laps,coalesce(sum(seconds),0) seconds
    from current_events group by 1
  ), rankings as (
    select kind,key,count(distinct visitor) visitors,count(*) filter(where event='race_start') starts,
      count(*) filter(where event='lap') laps,coalesce(sum(seconds),0) seconds,
      coalesce(sum(value) filter(where event='offtrack'),0) offtracks,
      min(lap_s) filter(where event='lap' and clean=true) best_lap
    from current_events e cross join lateral (values ('tracks',e.track),('cars',e.car),
      ('liveries',case when e.car is not null then e.car||'|'||e.livery::text end),
      ('devices',e.device),('controls',e.control),('modes',e.mode),('categories',e.category),('versions',e.version)) k(kind,key)
    where key is not null group by kind,key
  ), first_seen as (
    select v.visitor,(select min(e.at) from public.analytics_events e where e.visitor=v.visitor) first_at
    from (select distinct visitor from current_events) v
  ), audience as (
    select count(*) filter(where first_at >= (p_from::timestamp at time zone 'UTC')) new,
      count(*) filter(where first_at < (p_from::timestamp at time zone 'UTC')) as "returning"
    from first_seen where visitor in (select distinct visitor from current_events)
  ), recent as (
    select at,event,track,car,lap,lap_s,outcome from current_events
    where event in ('race_start','lap','race_end') order by at desc limit 30
  )
  select jsonb_build_object(
    'generated_at',now(),'first_event',(select min(at) from public.analytics_events),
    'last_event',(select max(at) from public.analytics_events),
    'current',coalesce((select data from totals where period='current'),'{}'::jsonb),
    'previous',coalesce((select data from totals where period='previous'),'{}'::jsonb),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by day) from daily d),'[]'::jsonb),
    'rankings',coalesce((select jsonb_object_agg(kind,rows) from
      (select kind,jsonb_agg(to_jsonb(r)-'kind' order by starts desc,laps desc,key) rows from rankings r group by kind) q),'{}'::jsonb),
    'audience',(select to_jsonb(a) from audience a),
    'hours',coalesce((select jsonb_agg(to_jsonb(h)) from
      (select extract(isodow from at at time zone 'UTC')::int as day,extract(hour from at at time zone 'UTC')::int as hour,
      count(*) starts from current_events where event='race_start' group by 1,2) h),'[]'::jsonb),
    'recent',coalesce((select jsonb_agg(to_jsonb(r) order by at desc) from recent r),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.analytics_report(date,date,text,text) from public,anon;
grant execute on function public.analytics_report(date,date,text,text) to authenticated;

-- Conservation conseillée : 13 mois ; si pg_cron est activé, programmer mensuellement :
-- delete from public.analytics_events where at < now()-interval '13 months';
notify pgrst, 'reload schema';
