# Recon map: Toki (web + Android)

Scope: núcleo — chat que transforma texto, áudio e print em eventos, tarefas, notas e lembretes; agenda; lembretes por push.
For: uso próprio / da equipe (sem pagamentos nem loja na v1)
Date: 2026-10-22

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | marketing site | https://toki.com/ | features, FAQ, plataformas |
| 2 | Google Play | https://play.google.com/store/apps/details?id=ai.orionarm.toki | descrição, 4.5★ / ~20k reviews, 1M+ downloads, Toki 3.0 |
| 3 | pricing | https://toki.com/pricing | Free (3 agendas) / Plus US$3.99 / Super US$9.99, trial 7 dias |
| 4 | llms.txt | https://toki.com/llms.txt | conceitos: To-dos (ex-Seeds), Triggers, Memory, Usage Credits |
| 5 | feature: triggers | https://toki.com/features/triggers | monitoramento de info pública + resumo matinal |
| 6 | feature: call me | https://toki.com/features/call-me | ligação no horário do evento marcado como importante |
| 7 | feature: booking | https://toki.com/features/booking | links de agendamento por contexto, convidado sem conta |

## Core loop

Você manda uma mensagem solta ("dentista quinta 15h", um print de convite, um áudio) e o assistente cria o item certo na agenda/lista e te lembra na hora.

## Screens

| ID | screen | route | purpose | key components | states |
| --- | --- | --- | --- | --- | --- |
| S01 | Entrar | /login | conta por e-mail | form, tabs entrar/criar | erro, carregando, confirmar e-mail |
| S02 | Assistente | / | chat com o assistente | lista de mensagens, cards de ação, composer (texto, mic, imagem) | vazio com sugestões, gravando, enviando, erro |
| S03 | Agenda | /agenda | dia/semana | seletor de dia, lista por hora, conflitos | vazio, cheio, conflito |
| S04 | Evento | sheet | editar/excluir evento | form, lembrete, "me ligue" (flag) | novo, edição |
| S05 | Tarefas | /tarefas | to-dos com ou sem prazo | lista, checkbox, filtro | vazio, concluídas |
| S06 | Notas | /notas | notas livres | lista, editor | vazio |
| S07 | Ajustes | /ajustes | perfil, fuso, push, memória, feed de agenda | toggles, lista de memória | push negado |

## Flows

```
F01 Capturar por texto
    S02 digita "reunião com Ana amanhã 10h" -> card "Evento criado" -> aparece em S03
    happy path clicks: 1 (enviar)
    edge: data ambígua, horário passado, conflito com outro evento, fuso diferente
F02 Capturar por print
    S02 anexa imagem -> assistente extrai data/local -> pede confirmação se faltar algo -> cria evento
    edge: imagem sem data, várias datas, imagem ilegível
F03 Capturar por voz
    S02 segura o mic -> áudio enviado -> cria item
    edge: microfone negado, áudio vazio
F04 Lembrete
    item com lembrete -> no horário chega push -> abre o item
    edge: push negado, app fechado, recorrente
F05 Planejar o dia
    S02 "como está meu dia?" -> resumo da agenda + tarefas + conflitos
F06 Tarefas
    S02 "preciso comprar ração" -> tarefa sem prazo em S05 -> marcar concluída
F07 Editar por conversa
    S02 "muda o dentista pra sexta" -> evento atualizado
```

## Inferred data model

```
Event     id, user_id, title, notes, location, start_at, end_at, all_day, recurrence(rrule), remind_minutes, important(call me), source
          evidence: Play listing (calendar, reminders, Call Me), llms.txt (recurring, conflicts)  confidence: high
Task      id, user_id, title, notes, due_at?, priority, done_at    evidence: llms.txt "To-dos (formerly Seed)"  confidence: high
Note      id, user_id, title, body                                  evidence: Play listing "Notes"  confidence: high
Reminder  id, user_id, title, remind_at, recurrence, sent_at, event_id?, task_id?   evidence: Play listing  confidence: medium
Memory    id, user_id, fact                                         evidence: llms.txt "Me > Intelligence > Memory"  confidence: high
Message   id, user_id, role, parts                                  evidence: chat UI  confidence: high
```

## Out of scope (v1)

- Triggers/monitoramento de preços e notícias, Call Me por telefone, links de booking, coordenação de grupo, Telegram/LINE, Apple Watch/Mac, planos pagos.
- Sync bidirecional Google/Outlook/iCloud: v1 entrega feed ICS (assinatura de agenda, uma via). Bidirecional precisa de app OAuth seu no Google Cloud.

## Size

Screens 7, flows 7, entities 6. Hard parts: interpretar datas em português com fuso, áudio/imagem, push confiável com app fechado. Size: M.
