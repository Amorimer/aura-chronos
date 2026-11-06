-- Financeiro: gastos (por texto, foto, áudio ou app), entradas do mês e categorias.
-- Each row belongs to one user and row level security keeps it private to them.

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 40),
  emoji text not null default '🏷️',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  description text not null default '' check (length(description) <= 200),
  category text not null default 'Outros' check (length(category) between 1 and 40),
  spent_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  source text not null default 'app' check (source in ('texto', 'foto', 'audio', 'app')),
  status text not null default 'pendente' check (status in ('pendente', 'confirmado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_user_month on public.expenses (user_id, spent_on);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount numeric(12,2) not null check (amount > 0 and amount < 100000000),
  description text not null default '' check (length(description) <= 200),
  received_on date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at timestamptz not null default now()
);
create index if not exists incomes_user_month on public.incomes (user_id, received_on);

alter table public.finance_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;
create policy own_rows on public.finance_categories for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.expenses for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.incomes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create trigger t_expenses before update on public.expenses for each row execute function public.touch_updated_at();

-- Default categories, created for each user the first time they use the finance screen or register a spend.
create or replace function public.ensure_finance_categories()
returns void language sql security invoker set search_path = '' as $$
  insert into public.finance_categories (user_id, name, emoji)
  select auth.uid(), c.name, c.emoji from (values
    ('Mercado', '🛒'), ('Feira', '🥬'), ('Transporte', '🚕'), ('Farmácia', '💊'),
    ('Alimentação fora', '🍽️'), ('Compras', '🛍️'), ('Contas da casa', '🏠'),
    ('Saúde', '🩺'), ('Lazer', '🎬'), ('Educação', '📚'), ('Outros', '🏷️')
  ) as c(name, emoji)
  where auth.uid() is not null
  on conflict (user_id, name) do nothing;
$$;
grant execute on function public.ensure_finance_categories() to authenticated;

-- R$ formatting without depending on the server locale: 1234.5 -> 1.234,50
create or replace function private.brl(v numeric)
returns text language sql immutable set search_path = '' as $$
  select translate(to_char(v, 'FM999,999,990.00'), ',.', '.,');
$$;

-- Morning brief on the 1st of the month gets last month's report.
alter table public.profiles add column if not exists last_month_report text;

create or replace function private.month_report(p_user uuid, p_month date)
returns text language sql stable security definer set search_path = '' as $$
  with e as (
    select category, sum(amount) total, count(*) n from public.expenses
    where user_id = p_user and spent_on >= p_month and spent_on < (p_month + interval '1 month')::date
    group by category order by 2 desc
  ), t as (
    select coalesce((select sum(total) from e), 0) gastos,
           coalesce((select sum(amount) from public.incomes where user_id = p_user and received_on >= p_month and received_on < (p_month + interval '1 month')::date), 0) entradas
  )
  select case when not exists (select 1 from e) and (select entradas from t) = 0 then null else
    'Entradas: R$ ' || private.brl((select entradas from t)) ||
    ' · Gastos: R$ ' || private.brl((select gastos from t)) ||
    ' · Saldo: R$ ' || private.brl((select entradas - gastos from t)) ||
    coalesce(' · Por categoria: ' || (select string_agg(category || ' R$ ' || private.brl(total), ', ' order by total desc) from e), '')
  end;
$$;
revoke all on function private.month_report(uuid, date) from public, anon, authenticated;


-- Dispatcher: brief mentions spends waiting for confirmation; monthly report on the 1st.
create or replace function private.dispatch()
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_url text; v_secret text;
  v_msgs jsonb := '[]'::jsonb;
  r record; p record; v_subs jsonb; v_today date; v_body text; v_n int; v_first text; v_first_id uuid; v_tasks int; v_next timestamptz; v_pending int; v_month date; v_report text;
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

    select count(*) into v_pending from public.expenses x where x.user_id = p.id and x.status = 'pendente';
    if v_pending > 0 then
      v_body := v_body || ' ' || v_pending || case when v_pending > 1 then ' gastos' else ' gasto' end || ' para conferir.';
    end if;

    -- 1st of the month: last month's spending report, as its own message.
    v_month := (date_trunc('month', v_today) - interval '1 month')::date;
    if extract(day from v_today) = 1 and coalesce(p.last_month_report, '') <> to_char(v_month, 'YYYY-MM') then
      update public.profiles set last_month_report = to_char(v_month, 'YYYY-MM') where id = p.id;
      v_report := private.month_report(p.id, v_month);
      if v_report is not null then
        v_msgs := v_msgs || jsonb_build_object('wa', private.wa_for(p.id), 'tag', 'month-' || to_char(v_month, 'YYYY-MM'),
          'title', 'Resumo financeiro de ' || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[extract(month from v_month)::int],
          'body', v_report, 'urgent', false, 'url', '/financas?m=' || to_char(v_month, 'YYYY-MM'), 'subs', v_subs);
      end if;
    end if;

    v_msgs := v_msgs || jsonb_build_object('wa', private.wa_for(p.id), 'tag', 'brief-' || v_today, 'title', 'Bom dia! Seu dia',
      'body', v_body, 'urgent', false, 'url', '/agenda', 'subs', v_subs,
      'ref', case when v_first_id is not null then 'e:' || v_first_id end,
      'brief', jsonb_build_object('events', v_n, 'tasks', v_tasks));
  end loop;

  -- Keep the free WhatsApp window open: about 12-23h after the user's last message, in the daytime,
  -- if they have something coming up in the next 14 days, ask for one tap. Any reply restarts the 24h.
  for p in
    select pr.* from public.profiles pr
    where pr.whatsapp_phone is not null and pr.whatsapp_notify
      and pr.whatsapp_last_inbound_at between now() - interval '23 hours' and now() - interval '12 hours'
      and (pr.wa_keepalive_at is null or pr.wa_keepalive_at < pr.whatsapp_last_inbound_at)
      and extract(hour from now() at time zone pr.timezone) between 8 and 21
      and exists (select 1 from public.reminders rm where rm.user_id = pr.id and rm.sent_at is null
                  and rm.remind_at between now() and now() + interval '14 days')
    for update skip locked
  loop
    update public.profiles set wa_keepalive_at = now() where id = p.id;
    v_msgs := v_msgs || jsonb_build_object('wa', private.wa_for(p.id), 'tag', 'keepalive', 'title', 'Quer continuar recebendo seus lembretes aqui?',
      'body', 'O WhatsApp só me deixa te avisar se você falou comigo nas últimas 24 horas. Toque no botão abaixo e eu sigo te lembrando dos seus compromissos.',
      'urgent', false, 'url', '', 'subs', '[]'::jsonb, 'keepalive', true);
  end loop;

  if jsonb_array_length(v_msgs) > 0 then
    perform net.http_post(
      url := v_url || '/api/cron/push',
      body := jsonb_build_object('messages', v_msgs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      timeout_milliseconds := 15000);
  end if;
end $function$;
