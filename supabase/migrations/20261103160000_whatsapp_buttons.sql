-- WhatsApp buttons on reminders and the morning brief: Concluído, Adiar (próximo dia / outra data), Ver o dia.

-- A one-off event can be marked done; its pending reminders stop.
alter table public.events add column if not exists done_at timestamptz;

-- "Outra data": the next message from the user is read as the new date for this item.
alter table public.profiles add column if not exists wa_pending jsonb;

create or replace function private.sync_event_reminders()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare t timestamptz; v_until timestamptz;
begin
  update public.reminders set sent_at = now() where event_id = new.id and sent_at is null;
  if new.done_at is not null and new.recurrence is null then
    return new;
  end if;
  v_until := case when new.recurrence_until is null then null else (new.recurrence_until + 1)::timestamptz end;
  if new.remind_minutes is not null then
    t := private.first_future(new.start_at - make_interval(mins => new.remind_minutes), new.recurrence);
    if t is not null and (v_until is null or t < v_until) then
      insert into public.reminders (user_id, title, body, remind_at, recurrence, urgent, event_id, until_at)
      values (new.user_id, new.title,
        case when new.remind_minutes = 0 then 'Agora' else 'Em ' ||
          case when new.remind_minutes >= 1440 then (new.remind_minutes / 1440) || ' dia(s)'
               when new.remind_minutes >= 60 then (new.remind_minutes / 60) || ' h' || case when new.remind_minutes % 60 > 0 then ' ' || (new.remind_minutes % 60) || ' min' else '' end
               else new.remind_minutes || ' min' end end
          || coalesce(' · ' || new.location, ''),
        t, new.recurrence, false, new.id, v_until);
    end if;
  end if;
  if new.important and coalesce(new.remind_minutes, -1) <> 0 then
    t := private.first_future(new.start_at, new.recurrence);
    if t is not null and (v_until is null or t < v_until) then
      insert into public.reminders (user_id, title, body, remind_at, recurrence, urgent, event_id, until_at)
      values (new.user_id, new.title, 'Começando agora' || coalesce(' · ' || new.location, ''), t, new.recurrence, true, new.id, v_until);
    end if;
  elsif new.important then
    update public.reminders set urgent = true where event_id = new.id and sent_at is null;
  end if;
  return new;
end $function$;

-- Today's events (not done) and open tasks due today or without date, for the "Ver o dia" list.
create or replace function public.wa_day_items(p_user uuid)
returns table (kind text, id uuid, at_label text, title text, sort_key text)
language sql stable security definer set search_path = '' as $$
  with p as (select timezone as tz, (now() at time zone timezone)::date as today from public.profiles where id = p_user)
  select 'e', e.id,
         case when e.all_day then 'Dia todo' else to_char(e.start_at at time zone p.tz, 'HH24:MI') end,
         e.title,
         case when e.all_day then '0' else '1' || to_char(e.start_at at time zone p.tz, 'HH24:MI') end
  from public.events e, p
  where e.user_id = p_user and e.done_at is null
    and public.occurs_on(e.start_at, e.recurrence, e.recurrence_until, p.today, p.tz)
  union all
  select 't', t.id,
         case when t.due_at is null then 'Tarefa' else 'Tarefa ' || to_char(t.due_at at time zone p.tz, 'HH24:MI') end,
         t.title,
         '2' || coalesce(to_char(t.due_at at time zone p.tz, 'YYYYMMDDHH24MI'), '9')
  from public.tasks t, p
  where t.user_id = p_user and t.done_at is null
    and (t.due_at is null or (t.due_at at time zone p.tz)::date <= p.today)
  order by 5
  limit 10;
$$;
revoke all on function public.wa_day_items(uuid) from public, anon, authenticated;
grant execute on function public.wa_day_items(uuid) to service_role;

-- Dispatcher: send what each notice refers to, so WhatsApp can show the right buttons.
create or replace function private.dispatch()
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_url text; v_secret text;
  v_msgs jsonb := '[]'::jsonb;
  r record; p record; v_subs jsonb; v_today date; v_body text; v_n int; v_first text; v_first_id uuid; v_tasks int; v_next timestamptz;
begin
  select value into v_url from private.app_config where key = 'app_url';
  select value into v_secret from private.app_config where key = 'cron_secret';
  if v_url is null or v_secret is null then return; end if;

  for r in
    select * from public.reminders
    where sent_at is null and remind_at <= now()
    order by remind_at limit 500 for update skip locked
  loop
    if r.remind_at > now() - interval '6 hours' then
      v_subs := private.subs_for(r.user_id);
      if jsonb_array_length(v_subs) > 0 or private.wa_for(r.user_id) is not null then
        v_msgs := v_msgs || jsonb_build_object('wa', private.wa_for(r.user_id),
          'tag', r.id, 'title', r.title, 'body', coalesce(r.body, ''), 'urgent', r.urgent,
          'url', case when r.event_id is not null then '/agenda?e=' || r.event_id
                      when r.task_id is not null then '/tarefas' else '/' end,
          'ref', case when r.event_id is not null then 'e:' || r.event_id
                      when r.task_id is not null then 't:' || r.task_id else 'r:' || r.id end,
          'subs', v_subs);
      end if;
    end if;
    if r.recurrence is null then
      update public.reminders set sent_at = now() where id = r.id;
    else
      v_next := private.next_occurrence(r.remind_at, r.recurrence);
      while v_next <= now() loop
        v_next := private.next_occurrence(v_next, r.recurrence);
      end loop;
      update public.reminders set remind_at = v_next, sent_at = case when r.until_at is not null and v_next >= r.until_at then now() end where id = r.id;
    end if;
  end loop;

  for p in
    select pr.* from public.profiles pr
    where pr.morning_brief
      and (now() at time zone pr.timezone)::time >= pr.morning_brief_time
      and (now() at time zone pr.timezone)::time < pr.morning_brief_time + interval '3 hours'
      and (pr.last_brief_on is null or pr.last_brief_on < (now() at time zone pr.timezone)::date)
    for update skip locked
  loop
    v_today := (now() at time zone p.timezone)::date;
    update public.profiles set last_brief_on = v_today where id = p.id;
    v_subs := private.subs_for(p.id);
    continue when jsonb_array_length(v_subs) = 0 and private.wa_for(p.id) is null;

    select count(*) into v_n from public.events e
      where e.user_id = p.id and e.done_at is null and public.occurs_on(e.start_at, e.recurrence, e.recurrence_until, v_today, p.timezone);
    v_first := null; v_first_id := null;
    select case when e.all_day then e.title else to_char(e.start_at at time zone p.timezone, 'HH24:MI') || ' ' || e.title end, e.id
      into v_first, v_first_id from public.events e
      where e.user_id = p.id and e.done_at is null and public.occurs_on(e.start_at, e.recurrence, e.recurrence_until, v_today, p.timezone)
      order by e.all_day desc, (e.start_at at time zone p.timezone)::time limit 1;
    select count(*) into v_tasks from public.tasks t
      where t.user_id = p.id and t.done_at is null
        and (t.due_at is null or (t.due_at at time zone p.timezone)::date <= v_today);

    v_body := case when v_n = 0 then 'Nenhum compromisso hoje.'
                   when v_n = 1 then '1 compromisso: ' || v_first || '.'
                   else v_n || ' compromissos. Primeiro: ' || v_first || '.' end
              || case when v_tasks > 0 then ' ' || v_tasks || ' tarefa' || case when v_tasks > 1 then 's' else '' end || ' em aberto.' else '' end;

    v_msgs := v_msgs || jsonb_build_object('wa', private.wa_for(p.id), 'tag', 'brief-' || v_today, 'title', 'Bom dia! Seu dia',
      'body', v_body, 'urgent', false, 'url', '/agenda', 'subs', v_subs,
      'ref', case when v_first_id is not null then 'e:' || v_first_id end,
      'brief', jsonb_build_object('events', v_n, 'tasks', v_tasks));
  end loop;

  if jsonb_array_length(v_msgs) > 0 then
    perform net.http_post(
      url := v_url || '/api/cron/push',
      body := jsonb_build_object('messages', v_msgs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      timeout_milliseconds := 15000);
  end if;
end $function$;
