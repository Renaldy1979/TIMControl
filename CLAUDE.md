# TIMControl — guia para qualquer agente Claude

Sistema departamental da área de Dev Ops (TIM). Primeiro módulo: **Kanban** de atividades, cada card uma tarefa para pessoas ou grupos (time, fábricas Accenture e Engineering), principalmente as que saem das reuniões e WarRooms e hoje se perdem no e-mail. **Não** é ferramenta de bug nem de chamados (a TIM já tem as oficiais). Dono e único desenvolvedor: Renaldy, com apoio do Claude.

## Leia antes de qualquer tarefa
1. `docs/01-visao-e-requisitos.md` — o que construir e por quê (escopo v1)
2. `docs/02-banco-de-dados.md` — modelo de dados e RLS (fonte da verdade)
3. `docs/03-arquitetura.md` — como as peças conversam (Next.js, Postgres, Appwrite, EasyPanel)
4. `docs/08-lotes.md` — entrega por lotes e o que entra em cada um
5. `design/design.md` — tokens e telas (a partir do modelo.webp em C:\Projetos\kanbanTim)
6. `docs/09-deploy.md` — deploy no EasyPanel

Se um documento e o código divergirem, **pare e avise** em vez de decidir sozinho. Mudanças de contrato (dados, tipos, permissões) são feitas no documento primeiro.

## Stack
Next.js (App Router) + TypeScript + Tailwind · **Postgres 16 + Drizzle** com **RLS** · **Appwrite 1.8.1 só para Auth (e-mail/senha) e, no Lote 3, bucket privado de anexos** (instância que já roda na VPS, projeto "TIMControl") · **EasyPanel** na VPS Hostinger, deploy a partir do GitHub · Testes: Vitest (unitários e de banco com RLS); testes de ponta a ponta automatizados (Playwright) entram no Lote 4.
Padrão de referência: projeto `controle-remedios` do dono (mesmo monorepo, `withFamilia` → aqui `withUser`, papéis dono/app, lotes com roteiro e validação).

## Regras inegociáveis
- **Permissão no servidor e no banco.** Toda Server Action confere `can()` (packages/shared) e todo acesso a dados passa por `withUser` (RLS com `app.user_id`). Esconder botão na tela não é segurança.
- **Visitante só vê o que foi liberado.** Projeto visível = Gestor, ou perfil específico no projeto (`project_members`), ou perfil global com "vê todos os projetos". A mesma regra existe em `permissions.ts` e no SQL (`app_sees_project()`, `app_profile_for()` e `app_can()`): mudou uma, mude a outra e os testes.
- **Gestor não perde poderes.** O perfil `gestor` tem tudo, não é editável, e ninguém tira o próprio perfil de Gestor.
- **`withSistema` só antes de saber quem é a pessoa** (login, convite, configuração inicial) ou para gravar algo da própria pessoa depois de conferir a identidade.
- **Dados sensíveis.** Prints e anexos podem ter dados de clientes: sem link público, sem dados pessoais em logs, auditoria em `audit_log`.
- **Fuso:** `America/Sao_Paulo`. Guardar UTC, exibir local. Datas dd/mm/aaaa, horário 24h.
- **Interface em pt-BR.** Código e nomes técnicos em inglês.
- **Acessibilidade:** alvos de toque ≥ 44px, contraste AA, estado nunca só por cor.

## Entrega por lotes (`docs/08-lotes.md`)
Cada lote termina com algo **testável pelo dono** no staging, com roteiro em `docs/lotes/L<n>-roteiro.md`. O lote só está pronto com testes verdes **e validação do dono** registrada em `docs/lotes/L<n>-validacao.md`. Não comece o lote seguinte sem o "validado".

## Convenções
- Monorepo pnpm: `apps/web` (portal), `packages/shared` (enums, permissões, schemas zod), `packages/domain` (regras puras), `packages/pg` (`@timcontrol/pg`: Postgres + Drizzle + RLS), `docs`, `design`, `prompts`.
- Migrações: `pnpm db:generate` para mudanças de schema; SQL à mão (RLS, funções) em migração `--custom`. Nunca editar migração já aplicada.
- Commits pequenos e em português, formato `tipo(escopo): descrição`. O Claude trabalha em branch e abre PR; o dono revisa e faz o merge.
- Nenhuma tarefa termina sem testes do que mudou e sem atualizar o doc afetado.
- Segredos só em variáveis de ambiente (EasyPanel); `.env.example` sempre atualizado.

## Comandos
```bash
corepack enable && pnpm install
cp .env.example .env        # preencha Appwrite e SETUP_CODE
pnpm db:up && pnpm db:migrate
pnpm dev                    # http://localhost:3000 → /configuracao-inicial na primeira vez
pnpm lint && pnpm typecheck && pnpm test
```
