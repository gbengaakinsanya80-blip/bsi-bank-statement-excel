-- ============================================================
-- 0013_board_meetings.sql — Board Meeting & Corporate
-- Compliance schema (WORLDMARK Regulatory & Board Compliance Hub)
--
-- board_meetings: meeting register + nested attendees, agenda,
-- resolutions, action points and documents (jsonb child records,
-- owned by their meeting). Links to reporting periods via
-- period_start / period_end so a meeting can be matched to the
-- same quarter as the NAICOM returns.
-- ============================================================

create table public.board_meetings (
  id               uuid primary key default gen_random_uuid(),
  meeting_number   text not null,
  meeting_type     text not null default 'SPECIAL' check (meeting_type in
                     ('Q1','Q2','Q3','Q4','AGM','SPECIAL')),
  quarter          int check (quarter between 1 and 4),
  financial_year   int not null,
  meeting_date     date not null,
  meeting_time     text,
  venue            text,
  status           text not null default 'DRAFT' check (status in
                     ('DRAFT','REVIEW','APPROVED','FINAL','CANCELLED')),
  chairman         text,
  secretary        text,
  agenda           jsonb not null default '[]'::jsonb,
  minutes          text not null default '',
  attendees        jsonb not null default '[]'::jsonb,
  resolutions      jsonb not null default '[]'::jsonb,
  action_points    jsonb not null default '[]'::jsonb,
  documents        jsonb not null default '[]'::jsonb,
  period_start     date,
  period_end       date,
  date_approved    timestamptz,
  approved_by      uuid references public.users (id),
  reopen_reason    text,
  created_by       uuid references public.users (id),
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.board_meetings (financial_year, quarter);
create index on public.board_meetings (meeting_date);
create index on public.board_meetings (status);

-- RLS -----------------------------------------------------------
alter table public.board_meetings enable row level security;
create policy "board_read_auth"   on public.board_meetings for select to authenticated using (deleted_at is null);
create policy "board_write_auth"  on public.board_meetings for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','REVIEWER'));

-- Triggers ------------------------------------------------------
drop trigger if exists touch_board_meetings_updated_at on public.board_meetings;
create trigger touch_board_meetings_updated_at before update on public.board_meetings for each row execute function public.set_updated_at();
