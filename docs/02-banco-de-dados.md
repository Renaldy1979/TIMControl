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
| `projects` | id, name, code (sigla), tower (producao/sustentacao/ambas), color, active | cadastráveis |
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

## Próximos lotes
Lote 2: `cards`, `card_assignees` (usuário ou grupo), `meetings`, `labels`, `card_labels`, `checklist_items`, `card_history`. Lote 3: `comments`, `attachments` (id do arquivo no Appwrite), `notifications`.
