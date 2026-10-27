-- LGPD retention rule (Termos item 3, Privacidade item 7): accounts with no use for 60 days are deleted.
-- Deleting the auth user cascades to every public table (events, tasks, notes, reminders, memories,
-- messages, push_subscriptions, wa_sessions, profiles).
-- "Use" = sign-in, any session refresh (the app open, or a WhatsApp message handled server-side),
-- an inbound WhatsApp message or a chat message.
-- TODO(T12): skip accounts with an active paid subscription once billing exists.

create table if not exists private.deletion_log (
  user_id uuid not null,
  reason text not null,
  last_activity timestamptz,
  deleted_at timestamptz not null default now()
);

create or replace function private.last_activity(u auth.users)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select greatest(
    u.created_at,
    u.last_sign_in_at,
    (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
    (select p.whatsapp_last_inbound_at from public.profiles p where p.id = u.id),
    (select max(m.created_at) from public.messages m where m.user_id = u.id)
  );
$$;

create or replace function private.purge_inactive(dry_run boolean default true, days int default 60)
returns table (user_id uuid, last_activity timestamptz, deleted boolean)
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select u.id, private.last_activity(u) as la
    from auth.users u
    where private.last_activity(u) < now() - make_interval(days => days)
  loop
    user_id := r.id; last_activity := r.la; deleted := false;
    if not dry_run then
      delete from auth.users where id = r.id;
      insert into private.deletion_log (user_id, reason, last_activity) values (r.id, 'inactive_' || days || 'd', r.la);
      deleted := true;
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function private.last_activity(auth.users) from public, anon, authenticated;
revoke all on function private.purge_inactive(boolean, int) from public, anon, authenticated;

-- Daily at 03:17 in São Paulo (06:17 UTC).
select cron.schedule('purge-inactive-accounts', '17 6 * * *', $$select private.purge_inactive(false, 60)$$);
