# 08 — Entrega por lotes

**Regra:** cada lote termina com algo que o dono **abre e testa** no staging, seguindo um **roteiro**. O lote só está pronto quando (1) os testes automáticos passam, (2) o dono validou o roteiro e (3) o resultado está em `docs/lotes/L<n>-validacao.md`. O lote seguinte só começa depois do "validado".

## Lote 1 — Fundação e acesso ✅ validado em 19/11/2026
**Você testa:** abrir o portal pelo link, fazer a configuração inicial, entrar como Gestor, convidar uma pessoa, ajustar uma permissão, cadastrar projeto e grupo, e conferir que um Visitante só vê o projeto liberado.
- Monorepo, CLAUDE.md, docs, CI, Dockerfile e `/api/health`.
- Banco com papéis dono/app, RLS e migrações. Perfis Gestor, Membro e Visitante com a matriz padrão.
- Login pelo Appwrite, esqueci a senha, convite por e-mail, desativar e reativar.
- Telas de Configurações: usuários, perfis e permissões, projetos (com acesso específico por pessoa) e grupos.
- Início com os projetos que a pessoa vê.

**Precisa do dono:** criar os serviços no EasyPanel e configurar o Appwrite (passo a passo no `docs/09-deploy.md`).

## Lote 2 — Kanban essencial
Cards dos dois tipos, vários responsáveis (pessoas e grupos), reuniões e WarRooms com seus cards, arrastar e soltar, quadro por projeto, visão geral, "Minhas atividades", "Pedi a outros", filtros e histórico do card.

## Lote 3 — Colaboração e visual
Comentários com menção, anexos no Appwrite Storage (bucket privado), checklist com barra de progresso, notificações internas, painel de contadores e instalação como app (PWA).

## Lote 4 — Estabilização
Backup criptografado do Postgres (R2), restauração testada, testes de ponta a ponta, lixeira de cards e ajustes pedidos pelo time.
