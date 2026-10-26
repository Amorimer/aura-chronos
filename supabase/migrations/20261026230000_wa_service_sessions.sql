-- Server-held session per user for requests that arrive via WhatsApp (no browser).
-- Only the secret key (server) can read it: RLS on, no policies, no grants to clients.
-- Note: earlier migrations were applied directly to the database; the baseline dump is task T1.
create table if not exists public.wa_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.wa_sessions enable row level security;
revoke all on public.wa_sessions from anon, authenticated;
