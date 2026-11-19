# 02 — Banco de dados (fonte da verdade)

Postgres 16 + Drizzle (`packages/pg/src/schema.ts`). Migrações em `packages/pg/drizzle/` (geradas por `pnpm db:generate`; RLS e funções à mão em `0001_rls.sql`). Ids UUID, datas `timestamptz` em UTC.

## Papéis do banco (`docker/init-roles.sh`)
| Papel | Para quê | RLS |
|---|---|---|
| `timcontrol_owner` | dono do schema; migrações, seed, testes | ignora (BYPASSRLS) |
| `timcontrol_app` | o portal | **vale sempre** (sem BYPASSRLS) |

## Tabelas do Lote 1
| Tabela | Campos principais | Observações |
|---|---|---|
| `profiles` | id, name, system_key (gestor/membro/visitante ou null), all_projects | `all_projects` = vê todos os projetos com este perfil |
| `profile_permissions` | profile_id, permission (`funcionalidade.ação`), scope (`all`/`own`) | linha ausente = não pode |
| `users` | id, appwrite_user_id, name, email, state (invited/active/disabled), global_profile_id | login e senha ficam no Appwrite |
| `invites` | id, user_id, token_hash, invited_by, expires_at, accepted_at | só o hash do token; vale 7 dias e uma vez |
| `projects` | id, name, code (sigla), color, active | cadastráveis |
| `project_members` | project_id, user_id, profile_id | perfil da pessoa naquele projeto; é o que libera projetos ao Visitante |
| `groups` | id, name, description, active | agrupam pessoas como responsável |
| `group_members` | group_id, user_id | |
| `audit_log` | id, actor_user_id, action, entity, entity_id, details, created_at | sem dados sensíveis em `details` |

Os nomes do escopo (Claude Docs) em português correspondem a estes: usuario → users, perfil → profiles, permissao → profile_permissions, projeto → projects, membro_projeto → project_members, grupo → groups, grupo_membro → group_members.

## Permissões (chaves da matriz)
- `kanban.view`, `kanban.create`, `kanban.edit`, `kanban.move`, `kanban.comment`, `kanban.delete`
- `meetings.view`, `meetings.create`, `meetings.edit`, `meetings.delete`
- `admin.users`, `admin.profiles`, `admin.projects`, `admin.groups`

`view`, `create` e `admin.*` só aceitam "todos". Uma funcionalidade nova entra em `FEATURES` (`packages/shared/src/enums.ts`) e ganha linhas na matriz.

## Quem vê o quê (RLS)
Contexto da transação: `app.user_id` (`withUser`) ou `app.sistema = 'on'` (`withSistema`).

| Tabela | Ler | Alterar |
|---|---|---|
| profiles, profile_permissions, users, groups, group_members | pessoa ativa | Gestor |
| invites | Gestor | Gestor |
| projects | quem vê o projeto (`app_sees_project`) | Gestor |
| project_members | as próprias linhas e as dos projetos que vê | Gestor |
| audit_log | Gestor | qualquer pessoa ativa, só em nome próprio |

`app_sees_project(id)`: Gestor; ou perfil específico do projeto com `kanban.view`; ou, sem perfil específico, perfil geral com `all_projects` e `kanban.view`. É a mesma regra de `profileFor` + `canSeeProject` em `packages/shared/src/permissions.ts`.

Convidados e desativados não veem nada, mesmo que o perfil seja Gestor.

## Tabelas do Lote 2 (Kanban)
| Tabela | Campos principais | Observações |
|---|---|---|
| `cards` | id, project_id, type (task/request), title, description, status (todo/doing/review/done), position, priority (low/normal/high/urgent), due_date, created_by, requester_id, requested_at, external_ref, meeting_id, completed_at, updated_at | `position` ordena a coluna (números com folga; a coluna é renumerada quando falta espaço) |
| `card_assignees` | id, card_id, user_id **ou** group_id | uma pessoa ou um grupo por linha |
| `labels` | id, name, color | cadastradas pelo Gestor (Configurações → Etiquetas), valem para todos os projetos |
| `card_labels` | card_id, label_id | |
| `card_history` | id, card_id, actor_user_id, action (created/moved/edited), details, created_at | `details` guarda colunas e nomes de campos, nunca o texto do card |
| `meetings` | id, project_id, kind (meeting/warroom), title, held_on, notes, created_by | Reunião ou WarRoom; os cards apontam para ela por `meeting_id` |
| `meeting_participants` | meeting_id, user_id | |

Datas sem hora (`due_date`, `requested_at`, `held_on`) são `date` e seguem o dia de São Paulo. "Atrasado" = prazo antes de hoje (São Paulo) e card fora de Concluído.

### Quem vê e altera (RLS do Lote 2, `drizzle/0005_kanban_rls.sql`)
Funções novas, com a mesma regra de `permissions.ts`:
- `app_profile_for(projeto)`: perfil que vale (Gestor global; senão o específico do projeto; senão o global se "vê todos os projetos").
- `app_can(projeto, permissão, é_meu)`: alcance "todos" sempre pode; "os seus" só se `é_meu`.
- `app_card_own(card)`: a pessoa criou o card ou é responsável, direto ou por um grupo dela. `app_meeting_own(reunião)`: criou ou participou.

| Tabela | Ler | Criar | Alterar | Excluir |
|---|---|---|---|---|
| cards | quem vê o projeto | `kanban.create`, em nome próprio | `kanban.edit` **ou** `kanban.move` (o servidor separa os dois) | `kanban.delete` |
| card_assignees, card_labels | junto com o card | quem edita o card ou quem o criou | idem | idem |
| card_history | junto com o card | em nome próprio, em card que vê | ninguém | ninguém (some com o card) |
| labels | pessoa ativa | Gestor | Gestor | Gestor |
| meetings | `meetings.view` no projeto | `meetings.create`, em nome próprio | `meetings.edit` | `meetings.delete` |
| meeting_participants | junto com a reunião | quem edita a reunião ou quem a criou | idem | idem |

Excluir um card é definitivo (a lixeira está prevista no Lote 4) e fica registrado no `audit_log`.

## Próximos lotes
Lote 3: `checklist_items`, `comments`, `attachments` (id do arquivo no Appwrite), `notifications`.
