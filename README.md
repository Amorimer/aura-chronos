# Aura Cronos

Assistente pessoal: a autoridade absoluta em otimizar o seu tempo.

Você manda uma mensagem, um print ou um áudio, e o Aura Cronos transforma em compromisso, tarefa, nota ou lembrete, com notificação na hora certa.

- App: https://aura-cronos.vercel.app
- Stack: Next.js 16 (App Router) na Vercel, Supabase (Postgres + Auth + pg_cron), AI SDK com Gemini, Web Push.

## Como funciona

| parte | onde |
| --- | --- |
| Chat e ferramentas do assistente | `src/app/api/chat/route.ts`, `src/lib/agent-tools.ts` |
| Telas | `src/app/(app)/*`, `src/components/*` |
| Lembretes | gatilhos no banco criam `reminders`; `pg_cron` roda `private.dispatch()` a cada minuto e chama `/api/cron/push` |
| Agenda no Google/iPhone | feed ICS em `/api/feed/<token>.ics` |
| Quem pode criar conta | tabela `private.allowed_emails` no Supabase |

## Variáveis de ambiente

Veja `.env.example`. Com `GOOGLE_GENERATIVE_AI_API_KEY` o app usa o Gemini direto; sem ela, usa o Vercel AI Gateway (`AI_MODEL`).

## Desenvolvimento

```bash
npm install
npm run dev
```

Cada push na branch `main` publica na Vercel.

## Liberar um novo usuário

No Supabase (SQL Editor):

```sql
insert into private.allowed_emails values ('pessoa@exemplo.com');
```
