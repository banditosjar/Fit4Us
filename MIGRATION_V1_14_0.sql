-- Fit4Us V1.14.0 – Belohnungen & Wunsch-Guthaben
-- Bestehende Daten bleiben erhalten.
-- Aktive Challenges werden NICHT verändert.

create table if not exists public.wish_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('earn','spend')),
  amount_cents integer not null,
  source_points_threshold integer,
  description text,
  created_at timestamptz not null default now(),
  check (
    (transaction_type='earn' and amount_cents=500 and source_points_threshold is not null and source_points_threshold>=100 and source_points_threshold%100=0)
    or
    (transaction_type='spend' and amount_cents<0 and source_points_threshold is null)
  ),
  check (description is null or char_length(description)<=120)
);

create unique index if not exists wish_credit_unique_earn_threshold
  on public.wish_credit_transactions(user_id,source_points_threshold)
  where transaction_type='earn';

alter table public.wish_credit_transactions enable row level security;

drop policy if exists wish_credit_read on public.wish_credit_transactions;
create policy wish_credit_read on public.wish_credit_transactions
for select to authenticated
using (public.approved_user());

drop policy if exists wish_credit_admin_all on public.wish_credit_transactions;
create policy wish_credit_admin_all on public.wish_credit_transactions
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select,insert,delete on public.wish_credit_transactions to authenticated;

-- Ein freigegebener Nutzer darf die 5-Euro-Stufen nur nacheinander beanspruchen.
-- Die App ruft dies automatisch anhand des realen Fit4Us-Punktestands auf.
create or replace function public.claim_wish_credit(target_threshold integer)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  next_threshold integer;
  new_id uuid;
begin
  if not public.approved_user() then
    raise exception 'Approved user required';
  end if;

  if target_threshold < 100 or target_threshold % 100 <> 0 then
    raise exception 'Invalid points threshold';
  end if;

  select coalesce(max(source_points_threshold),0)+100
    into next_threshold
  from public.wish_credit_transactions
  where user_id=auth.uid() and transaction_type='earn';

  if target_threshold <> next_threshold then
    raise exception 'Threshold must be claimed sequentially';
  end if;

  insert into public.wish_credit_transactions(
    user_id,transaction_type,amount_cents,source_points_threshold,description
  ) values (
    auth.uid(),'earn',500,target_threshold,'Automatisch durch Fit4Us-Punkte verdient'
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.claim_wish_credit(integer) to authenticated;

create or replace function public.redeem_wish_credit(spend_cents integer, spend_note text default null)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  current_balance integer;
  new_id uuid;
  clean_note text;
begin
  if not public.approved_user() then
    raise exception 'Approved user required';
  end if;

  if spend_cents is null or spend_cents <= 0 then
    raise exception 'Amount must be positive';
  end if;

  clean_note := nullif(trim(coalesce(spend_note,'')),'');
  if clean_note is not null and char_length(clean_note)>120 then
    raise exception 'Description too long';
  end if;

  select coalesce(sum(amount_cents),0)
    into current_balance
  from public.wish_credit_transactions
  where user_id=auth.uid();

  if spend_cents > current_balance then
    raise exception 'Insufficient wish credit';
  end if;

  insert into public.wish_credit_transactions(
    user_id,transaction_type,amount_cents,source_points_threshold,description
  ) values (
    auth.uid(),'spend',-spend_cents,null,clean_note
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.redeem_wish_credit(integer,text) to authenticated;

-- Andere freigegebene Teilnehmer dürfen die aktuell offenen normalen Belohnungen sehen.
drop policy if exists rewards_select_own on public.reward_choices;
drop policy if exists rewards_select_approved on public.reward_choices;
create policy rewards_select_approved on public.reward_choices
for select to authenticated
using (public.approved_user());

-- Einlösen/Ändern bleibt weiterhin nur für den Besitzer bzw. Admin erlaubt.
drop policy if exists rewards_update_own on public.reward_choices;
create policy rewards_update_own on public.reward_choices
for update to authenticated
using (public.approved_user() and (user_id=auth.uid() or public.is_admin()))
with check (public.approved_user() and (user_id=auth.uid() or public.is_admin()));

do $$
begin
 if not exists (
  select 1 from pg_publication_tables
  where pubname='supabase_realtime'
    and schemaname='public'
    and tablename='wish_credit_transactions'
 ) then
  alter publication supabase_realtime add table public.wish_credit_transactions;
 end if;
end $$;
