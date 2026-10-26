# Épico: Marco "teste com 10 pessoas" (Google Agenda só leitura → lembretes no WhatsApp)

Status: DRAFT (Phase 4 do /spec) · Origem: plano aprovado `docs/designs/agenda-no-whatsapp-ate-as-lojas.md`, decisão D18 · Data de verificação do estado atual: 2026-10-26

## Context
O Aura Cronos só funciona hoje para o fundador. Antes de construir cadastro pelo WhatsApp, cobrança e lojas, o plano aprovado (D18) pede um teste com 10 pessoas que prove a hipótese central: **a agenda do Google da pessoa chegando no WhatsApp faz ela não perder compromissos**. Este épico entrega o mínimo para esse teste, com rastreio de entrega para medir "zero compromisso perdido".

## Current State (verificado em 2026-10-26)
| Componente | Hoje | Lacuna para o teste |
|---|---|---|
| Lembretes | `private.dispatch()` (pg_cron `* * * * *`) marca `reminders.sent_at` **antes** da rota confirmar e envia lembretes com até 6 h de atraso | Lembrete perdido sem ninguém saber; lembrete velho enviado |
| Envio WhatsApp | `src/lib/whatsapp.ts:68-69`: um template só (`WHATSAPP_TEMPLATE`, hoje **não definido**), então fora da janela de 24h **nada sai** | Templates com botões |
| Status de entrega | Webhook lê só `messages` (`src/app/api/whatsapp/webhook/route.ts:28-29`); `statuses` ignorado; nenhum `wamid` guardado | Rastreio por lembrete |
| Botões | `Inbound` lê só `button.text` (`src/lib/whatsapp-agent.ts:8-16`), sem `payload`/`interactive` | Vou / Adiar |
| Processamento | `after()` no webhook; se a função morrer, a mensagem se perde (a Meta já recebeu 200) | Inbox durável |
| Google Agenda | Só o feed ICS de saída (`src/app/api/feed/[token]/route.ts`) | Leitura dos eventos do Google |
| Resumo da manhã | Em `private.dispatch()`; manda "Nenhum compromisso hoje." mesmo vazio; resumo de 1 linha | Lista do dia; não enviar vazio |
| Cadastro | Lista de liberação `private.allowed_emails` (`src/app/login/actions.ts:36-38`) | Liberar os 10 Gmails |
| Migrations | Só `supabase/migrations/20261026230000_wa_service_sessions.sql`; o resto foi aplicado direto no banco | Baseline |
| Testes / erros | Nenhum teste; sem Sentry | Testes do marco + Sentry (D7) |

## Child Issues
| # | Título | Prioridade | Esforço (humano / CC) | Depende de |
|---|---|---|---|---|
| 1 | Base: baseline do schema, ambiente de teste e `app_flags` | Critical | 1,5 d / 1 h | — |
| 2 | Rastreio de entrega dos lembretes e correção do dispatch | Critical | 1,5 d / 1 h | 1 |
| 3 | Inbox durável, templates e botões Vou/Adiar | Critical | 2 d / 1 h 30 | 1, 2 |
| 4 | Google Agenda só leitura (OAuth, sincronização, Ajustes, guarda no assistente) | Critical | 3 d / 2 h | 1 |
| 5 | Resumo do dia novo | High | 0,5 d / 30 min | 3, 4 |
| 6 | Testes do marco e Sentry | High | 2 d / 1 h 30 | 2-5 (em paralelo) |

## Dependency Graph
```
#1 Base ──┬─> #2 Entrega ──> #3 Inbox + botões ──┐
          └─> #4 Google ─────────────────────────┴─> #5 Resumo do dia
#6 Testes + Sentry: acompanha cada issue (teste entra junto com o código)
```
**Por que esta ordem:** sem a baseline (#1) não há ambiente de teste seguro; sem o rastreio (#2) não dá para medir "zero compromisso perdido"; os botões (#3) dependem dos templates e do `wamid` de #2; o resumo (#5) precisa dos eventos do Google (#4) e do template com botão (#3).

---

## #1 Base: baseline, ambiente de teste e `app_flags`
**Implementação**
- `supabase/migrations/20261026000000_baseline.sql`: extrair do banco de produção (via SQL de catálogo, `pg_get_functiondef`, `pg_get_triggerdef`, policies e `cron.job`) todas as tabelas `public`, funções `public`/`private`, triggers, RLS, grants e o job do pg_cron. Prova: aplicar num projeto Supabase novo e rodar `select private.dispatch()` sem erro.
- Projeto Supabase de teste (grátis) para as prévias da Vercel; variáveis de ambiente de *Preview* apontam para ele e para o número de teste da Meta (`WHATSAPP_PHONE_NUMBER_ID=1097108606826184`).
- Tabela:
```sql
create table public.app_flags (key text primary key, enabled boolean not null default false);
alter table public.app_flags enable row level security;
revoke all on public.app_flags from anon, authenticated;
insert into public.app_flags(key, enabled) values
  ('google_sync', false), ('wa_buttons', false), ('brief_v2', false), ('send_tracking', false);
```
- `src/lib/flags.ts`: `isOn(key)` com cache de 30 s (cliente admin). `private.dispatch()` lê `public.app_flags` direto.

## #2 Rastreio de entrega e correção do dispatch
**Schema**
```sql
create table public.wa_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid references public.reminders(id) on delete set null,
  kind text not null check (kind in ('reminder','brief','reply')),
  wamid text unique,
  status text not null default 'accepted' check (status in ('accepted','sent','delivered','read','failed','fallback_push','undeliverable')),
  error_code int, error_title text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.wa_sends (status, created_at);
alter table public.wa_sends enable row level security;  -- só servidor
alter table public.reminders add column confirmed_at timestamptz, add column attempts int not null default 0;
```
**Comportamento**
- `/api/cron/push` grava uma linha em `wa_sends` por envio com o `wamid` retornado e confirma o lembrete (`reminders.confirmed_at = now()`) só depois de a Meta aceitar (HTTP 200).
- `private.dispatch()` passa a pegar também lembretes com `sent_at` preenchido, `confirmed_at` nulo, `sent_at < now() - 5 min` e `attempts < 3`, e incrementa `attempts`.
- Lembrete atrasado mais de **10 minutos** (antes: 6 h) não é enviado; grava `wa_sends.status='undeliverable'` com `error_title='stale'`.
- Para quem tem WhatsApp ligado, o cron **não** manda web push junto; web push vira reserva.
- Webhook trata `entry[].changes[].value.statuses[]`: atualiza `wa_sends` por `wamid`. Se `failed`: tenta web push (`push_subscriptions` ativas); com push enviado → `fallback_push`; sem inscrição → `undeliverable` e evento no Sentry `reminder_undeliverable` com `user_id`.
- Status fora de ordem (ex.: `delivered` depois de `read`) não rebaixa: ordem `accepted < sent < delivered < read`; `failed` sempre grava.

## #3 Inbox durável, templates e botões Vou/Adiar
**Schema**
```sql
create table public.wa_inbox (
  wamid text primary key,
  phone text not null,
  payload jsonb not null,
  status text not null default 'new' check (status in ('new','processing','done','failed')),
  attempts int not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.wa_inbox (phone, created_at) where status in ('new','processing');
alter table public.wa_inbox enable row level security;
```
**Comportamento**
- O webhook valida a assinatura, grava cada mensagem em `wa_inbox` (`on conflict (wamid) do nothing`) e responde 200. No `after()`, processa as mensagens daquele telefone **uma por vez, em ordem de `created_at`**. A trava é: só processa se não houver outra linha do mesmo telefone em `processing` com `locked_at` de menos de 2 min.
- Cron novo (`* * * * *`) chama `/api/cron/inbox` (com `CRON_SECRET`), que reprocessa linhas `new`, ou `processing` com `locked_at` de mais de 2 min, com `attempts < 3`. Na 3ª falha → `failed`, evento no Sentry e resposta à pessoa: "Não consegui processar sua mensagem. Pode mandar de novo?".
- Todo telefone é comparado já normalizado (`normalizeTo`, 9º dígito).
- **Templates na Meta** (categoria Utilidade, idioma `pt_BR`), criados pelo fundador com a minha ajuda no navegador:
  - `aura_lembrete`: corpo "⏰ {{1}}\n{{2}}" (título; hora e local, ou só a hora se não houver local). Botões de resposta rápida: `Vou`, `Adiar 10 min`.
  - `aura_resumo_dia`: corpo "Bom dia! Sua agenda de hoje:\n{{1}}". Botão: `Ok`.
- `src/lib/whatsapp.ts`: `sendTemplate(to, name, params, buttonPayloads)`, com `components` do tipo `button`, `sub_type: quick_reply` e `payload` por botão.
- Payloads: `vou:<reminder_id>`, `adiar:<reminder_id>`, `ok:brief:<YYYY-MM-DD>`. O webhook lê `button.payload` e `interactive.button_reply.id`.
- **Vou:** responde "Combinado ✅" (texto grátis, a janela está aberta) e marca `wa_sends.status='read'`.
- **Adiar 10 min:** cria um lembrete avulso (`remind_at = now() + 10 min`, mesmo `event_id`, `title`, `body`) e responde "Te lembro de novo às HH:MM". O mesmo botão tocado de novo (mesmo `reminder_id` + mesmo `wamid` de origem) não cria outro.
- **Ok:** só registra.
- Texto simples continua indo para o assistente como hoje.

## #4 Google Agenda só leitura
**Configuração (fundador, com a minha ajuda):** projeto no Google Cloud, Calendar API ativada, tela de consentimento "Externo" com escopos `openid`, `email`, `https://www.googleapis.com/auth/calendar.readonly` e `https://www.googleapis.com/auth/calendar.calendarlist.readonly`. URI de redirecionamento: `https://aura-cronos.vercel.app/api/google/callback`. Primeiro tenta publicar "Em produção" sem verificação; se o Google recusar o domínio `vercel.app`, fica em "Teste" com os 10 Gmails como usuários de teste (acesso expira em 7 dias, ver reconexão abaixo).

**Schema**
```sql
create table public.google_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,          -- AES-256-GCM, chave GOOGLE_TOKEN_KEY (env)
  calendar_ids text[] not null default '{primary}',
  status text not null default 'active' check (status in ('active','broken')),
  last_sync_at timestamptz, last_error text,
  created_at timestamptz not null default now()
);
alter table public.google_accounts enable row level security;  -- só servidor
alter table public.events
  add column google_event_id text, add column google_calendar_id text, add column html_link text;
create unique index on public.events (user_id, google_calendar_id, google_event_id) where google_event_id is not null;
create function public.google_status() returns table(google_email text, status text, last_sync_at timestamptz, calendar_ids text[])
  language sql security definer set search_path = '' as
  $$ select google_email, status, last_sync_at, calendar_ids from public.google_accounts where user_id = auth.uid() $$;
```
**Rotas**
- `GET /api/google/connect`: exige login; cria `state` aleatório em cookie `httpOnly` (10 min) e redireciona para o consentimento com `access_type=offline&prompt=consent`.
- `GET /api/google/callback`: confere o `state` (diferente → 400 e log); troca o `code`; guarda o refresh token criptografado; roda a primeira sincronização; redireciona para `/ajustes?google=ok`.
- `POST /api/google/disconnect`: revoga o token no Google, apaga `google_accounts` e os eventos `source='google'` da pessoa.
- `/api/cron/google-sync`: cron a cada 5 min, com `CRON_SECRET`, só se `google_sync` estiver ligada.

**Sincronização (a cada 5 min, por conta ativa e por agenda)**
- `events.list` com `singleEvents=true`, `timeMin = agora - 1 dia`, `timeMax = agora + 90 dias`, `showDeleted=false`, todas as páginas.
- Cada evento vira upsert em `events` com `source='google'`. Regras de mapeamento:
  - **Dia inteiro** (`start.date`): `all_day=true` e `remind_minutes = null` (aparece só no resumo do dia).
  - **Com hora:** `start_at`/`end_at` a partir de `start.dateTime` (com fuso).
  - **Lembrete:** `remind_minutes` = menor `reminders.overrides[method=popup].minutes`; se `useDefault`, usa o padrão da agenda; se não houver nenhum, 30.
  - **Recusado** (`attendees[self].responseStatus = declined`) ou `status = cancelled`: não entra; se já existia, é apagado.
  - `html_link = htmlLink`.
- Eventos `source='google'` da pessoa dentro da janela que não voltaram na consulta são apagados.
- Os lembretes ligados (`reminders.event_id`) seguem pelos triggers que já existem.
- **Erros:**
  - 401/400 `invalid_grant` → `status='broken'` e mensagem pelo WhatsApp (texto se a janela estiver aberta; senão no próximo resumo do dia): "Sua conexão com o Google Agenda caiu. Toque para reconectar: <link>".
  - 429/5xx → tenta de novo no próximo ciclo e registra no Sentry depois de 3 falhas seguidas.

**Ajustes (`src/components/settings.tsx`)**
- Nova seção "Google Agenda". Estados:
  - não conectado: botão "Conectar Google Agenda";
  - conectando: carregando;
  - conectado: e-mail, lista de agendas com caixas de seleção (via `calendarList.list`), "Última atualização há N min" e o botão "Desconectar";
  - conexão caída: aviso vermelho e botão "Reconectar".

**Assistente**
- `update_event` e `delete_event` (`src/lib/agent-tools.ts:125`, `:174`) recusam eventos com `source='google'` e devolvem `{ error: "google_readonly", html_link }`.
- O assistente responde: "Esse compromisso é do Google Agenda; mude por lá: <html_link>" (D4).

## #5 Resumo do dia novo
- Em `private.dispatch()`, atrás da flag `brief_v2`: só envia se houver ao menos 1 evento ou tarefa no dia.
- Conteúdo: até 10 linhas "HH:MM Título (Local)", com os eventos de dia inteiro primeiro, e depois "N tarefas para hoje". Se passar de 10 itens: "+N outros".
- Envio: texto se `whatsapp_last_inbound_at` for de menos de 23 h; senão, template `aura_resumo_dia`.

## #6 Testes do marco e Sentry
- Dependências novas: `vitest` (dev) e `@sentry/nextjs`. `SENTRY_DSN` em produção e prévia. Captura erros do webhook, dos crons, da sincronização e do agente, com tag `user_id`, nunca o conteúdo das mensagens.
- `package.json`: `"test": "vitest run"`.

## Acceptance Criteria
1. Um evento com hora criado no Google às 10:00 com lembrete de 15 min gera exatamente 1 mensagem `aura_lembrete` entre 09:45 e 09:46 (com até 5 min de atraso de sincronização se ele foi criado há menos de 5 min), e 1 linha em `wa_sends` com `kind='reminder'` e `wamid` preenchido.
2. Evento remarcado no Google para 11:00 antes do lembrete: em até 5 min o lembrete passa para 10:45, e nenhuma mensagem sai às 09:45.
3. Evento apagado ou recusado no Google antes do lembrete: nenhuma mensagem sai.
4. Evento de dia inteiro: nenhum lembrete com hora; aparece no resumo do dia.
5. Status `failed` da Meta para um lembrete: com push ativo, web push enviado e `wa_sends.status='fallback_push'`; sem push, `undeliverable` + 1 evento no Sentry.
6. Se `/api/cron/push` não confirmar em 5 min, o lembrete é reenviado (máx. 3 tentativas); depois de 3, `undeliverable` + Sentry.
7. Lembrete atrasado mais de 10 min não é enviado e fica registrado como `stale`.
8. Toque em "Adiar 10 min" cria 1 lembrete 10 min depois; o mesmo toque entregue 2 vezes pela Meta cria só 1.
9. Duas mensagens do mesmo número com 1 s de intervalo são respondidas na ordem em que chegaram, nunca em paralelo.
10. Pedido ao assistente para mudar ou apagar um evento `source='google'` não altera nada e responde com o `html_link`.
11. Resumo do dia não é enviado em dia sem eventos nem tarefas; com 12 itens mostra 10 + "+2 outros".
12. `state` do OAuth diferente do cookie → HTTP 400 e nenhum token guardado.
13. Token do Google revogado → `google_accounts.status='broken'` em até 5 min e aviso de reconexão enviado.
14. Com `google_sync` desligada, nenhuma chamada ao Google acontece; com `wa_buttons` desligada, os lembretes saem sem botões pelo template antigo.
15. Prévia da Vercel usa o Supabase de teste e o número de teste da Meta (conferir as variáveis de Preview).
16. `npm test` passa e cobre os itens da tabela abaixo.
17. Cada teste declara: `protects=<observável>; fails_when=<resultado errado que rejeita>; no_claim=<o que o verde não prova; quais mocks substituem o quê>`.
18. Nada do que já funciona (chat do app, criação de compromissos, vínculo do WhatsApp, páginas legais, aceite LGPD) muda de comportamento.

## Testing Plan
| Camada | O quê | Qtde |
|---|---|---|
| Unidade | Mapeamento Google → `events` (dia inteiro, recusado, cancelado, fuso, minutos do lembrete, padrão 30) | +7 |
| Unidade | Parse de payload dos botões; montagem dos `components` do template | +4 |
| Unidade | Regras de status (ordem, `failed` sempre grava) e de lembrete vencido | +4 |
| Integração (fetch da Meta e do Google simulados) | webhook `statuses` → `wa_sends` → reserva por push | +3 |
| Integração | inbox: duplicata do mesmo `wamid`, ordem por telefone, reprocessamento | +3 |
| Integração | OAuth `state` inválido; token revogado → `broken` | +2 |
| Manual (lista no PR) | Ponta a ponta com o celular do fundador: evento no Google → lembrete → Adiar → lembrete de novo | 1 |

## Rules for the implementing agent
1. Acceptance criteria are the `protects / fails_when / no_claim` profile of each test: the observable it protects, the wrong result it rejects, and what green does not prove. Never "make the tests pass".
2. Real code and real tests land in the same change; a placeholder, a stub assertion or a test deferred to a follow-up is not done.
3. Any change to a test, validator, CI step, timeout, tolerance, threshold, snapshot or suppression pragma is reported on its own line in your summary with its justification, before any other result.
4. A reported command names the command and its observed result (exit status, counts, the failing line); a command you did not run is not reported, and stderr is never silenced in a command you cite.
5. Your report is a claim until the parent re-executes it: say what you verified, what you reused, and what you could not check.

## Rollback Plan
- Toda mudança de comportamento fica atrás de uma flag em `app_flags` (`google_sync`, `wa_buttons`, `brief_v2`, `send_tracking`); desligar volta ao comportamento atual em até 1 min, sem deploy.
- Migrations só adicionam tabelas e colunas (nada é apagado ou renomeado), então o código anterior continua funcionando com o banco novo.
- Pior caso: reverter o commit na Vercel (Instant Rollback) e desligar as flags.

## Effort Estimate
| Parte | Humano | CC |
|---|---|---|
| #1 baseline + ambiente + flags | 1,5 d | 1 h |
| #2 rastreio + dispatch | 1,5 d | 1 h |
| #3 inbox + templates + botões | 2 d | 1 h 30 |
| #4 Google (OAuth, sync, Ajustes, guarda) | 3 d | 2 h |
| #5 resumo | 0,5 d | 30 min |
| #6 testes + Sentry | 2 d | 1 h 30 |
| **Total** | **~10,5 d** | **~7 h 30** |
Esperas externas (fora da engenharia): aprovação dos 2 templates pela Meta (horas a 1 dia) e configuração do Google Cloud pelo fundador.

## Files Reference
| Arquivo | Mudança |
|---|---|
| `supabase/migrations/20261026000000_baseline.sql` | novo: schema atual |
| `supabase/migrations/*_marco_teste.sql` | novo: `app_flags`, `wa_sends`, `wa_inbox`, `google_accounts`, colunas em `events`/`reminders`, `google_status()`, `private.dispatch()` alterada, crons novos |
| `src/lib/flags.ts` | novo |
| `src/lib/whatsapp.ts:56-90` | `sendTemplate` com botões; `preview_url` só onde há link não sensível |
| `src/app/api/whatsapp/webhook/route.ts:15-60` | inbox, `statuses`, payload de botões |
| `src/lib/whatsapp-agent.ts:8-16` | tipo `Inbound` com `button.payload` e `interactive` |
| `src/app/api/cron/push/route.ts:23-48` | `wa_sends`, confirmação, push só como reserva |
| `src/app/api/cron/inbox/route.ts` | novo |
| `src/lib/google.ts` | novo: OAuth, criptografia do token, `events.list`, mapeamento |
| `src/app/api/google/{connect,callback,disconnect}/route.ts` | novos |
| `src/app/api/cron/google-sync/route.ts` | novo |
| `src/lib/agent-tools.ts:125`, `:174` | recusa em `source='google'` |
| `src/components/settings.tsx` | seção Google Agenda |
| `src/proxy.ts` | `/api/google/callback` e `/api/cron/*` públicos (protegidos por `state`/`CRON_SECRET`) |
| `vitest.config.ts`, `src/**/*.test.ts` | novos |
| `sentry.*.config.ts`, `instrumentation.ts` | novos |

## Out of Scope
- Escrever no Google (criar, editar, apagar): só antes do lançamento.
- Push notifications do Google (canais): só antes do lançamento; aqui a consulta é a cada 5 min.
- Cadastro pelo WhatsApp (E1), encaminhar (E2), Remarcar (E3), resumo da semana (E4), indicação (E6).
- Cobrança, teste grátis de 14 dias, desconexão no 20º dia, exclusão após 60 dias.
- CI no GitHub bloqueando deploy, Playwright, painel interno de custo (lançamento, D14/D15).
- Domínio próprio e SMTP.
- Play Store e App Store.

## Definition of Done
1. Os 18 critérios de aceite passam (testes automáticos, mais o roteiro manual do critério 1 feito no celular do fundador).
2. As 4 flags ligadas em produção por 24 h sem nenhum `undeliverable` que não seja `stale`.
3. Os 10 Gmails dos testadores estão em `private.allowed_emails` (quando o fundador mandar).
4. Os 2 templates estão aprovados na Meta.

## Related
- Plano: `docs/designs/agenda-no-whatsapp-ate-as-lojas.md` (D11, D13, D14, D15, D16, D17, D18; OV-03, OV-04, OV-05, OV-07, OV-13)
