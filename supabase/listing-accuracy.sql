-- SitCheck: listing accuracy confirmations
-- Run once in the Supabase SQL editor before shipping the app update.

alter table public.toilets
  add column if not exists confirm_count integer not null default 0,
  add column if not exists last_confirmed_at timestamptz,
  add column if not exists inaccurate_count integer not null default 0;

create or replace function public.record_listing_accuracy(
  p_toilet_id text,
  p_is_accurate boolean
)
returns table (
  confirm_count integer,
  inaccurate_count integer,
  last_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.toilets%rowtype;
begin
  if p_is_accurate then
    update public.toilets
    set
      confirm_count = coalesce(public.toilets.confirm_count, 0) + 1,
      last_confirmed_at = now()
    where public.toilets.id::text = p_toilet_id
    returning * into updated_row;
  else
    update public.toilets
    set
      inaccurate_count = coalesce(public.toilets.inaccurate_count, 0) + 1
    where public.toilets.id::text = p_toilet_id
    returning * into updated_row;
  end if;

  if updated_row.id is null then
    raise exception 'Listing not found';
  end if;

  return query
  select
    updated_row.confirm_count,
    updated_row.inaccurate_count,
    updated_row.last_confirmed_at;
end;
$$;

revoke all on function public.record_listing_accuracy(text, boolean) from public;
grant execute on function public.record_listing_accuracy(text, boolean) to anon, authenticated;
